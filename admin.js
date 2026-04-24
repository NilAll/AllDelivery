const supabaseUrl = 'https://eyslsyyctmokrbuwoprk.supabase.co';
const supabaseKey = 'sb_publishable_t9cAvHh2w-VWP3zxwSndmA_x0FPqsM1';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let idDaLojaLogada = null;
let produtosCarregadosAdmin = []; 
let categoriasCarregadasAdmin = [];

// === MENU MOBILE ===
window.toggleMenu = function() {
    document.getElementById('menu-mobile').classList.toggle('active');
}
window.onclick = function(event) {
    if (!event.target.matches('.menu-icon')) {
        const menu = document.getElementById('menu-mobile');
        if (menu.classList.contains('active')) menu.classList.remove('active');
    }
}

async function verificarSessao() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { window.location.href = "login.html"; return; }
    buscarLojaDoUsuario(session.user.id);
}

async function buscarLojaDoUsuario(userId) {
    const { data: loja, error } = await db.from('lojas').select('*').eq('user_id', userId).single();
    if (error || !loja) { document.getElementById('nome-loja-admin').innerText = "Erro: Loja não encontrada."; return; }

    idDaLojaLogada = loja.id;
    document.getElementById('nome-loja-admin').innerText = loja.nome;
    
    // Mostra taxa com vírgula
    document.getElementById('taxa-entrega-admin').value = Number(loja.taxa_entrega).toFixed(2).replace('.', ',');
    document.getElementById('pix-admin').value = loja.chave_pix || '';

    const urlBase = window.location.href.split('admin.html')[0];
    document.getElementById('btn-ver-loja').href = `${urlBase}loja.html?loja=${loja.slug}`;

    carregarCategoriasAdmin();
    carregarProdutosAdmin();
}

async function carregarCategoriasAdmin() {
    const { data: categorias } = await db.from('categorias').select('*').eq('loja_id', idDaLojaLogada).order('nome');
    const selectCat = document.getElementById('cat-prod');
    const listaHTML = document.getElementById('lista-categorias-admin');
    
    selectCat.innerHTML = '<option value="">Sem Categoria (Fica solto na lista)</option>';
    listaHTML.innerHTML = '';

    if (categorias) {
        categoriasCarregadasAdmin = categorias;
        categorias.forEach(cat => {
            selectCat.innerHTML += `<option value="${cat.id}">${cat.nome}</option>`;
            listaHTML.innerHTML += `
                <div style="background:white; border:1px solid #ccc; padding:6px 10px; border-radius:6px; display:flex; gap:10px; align-items:center; font-size:0.85em; font-weight:bold;">
                    ${cat.nome}
                    <button onclick="removerCategoria('${cat.id}')" style="background:#ff4757; border:none; color:white; cursor:pointer; border-radius:4px; padding:3px 6px;">X</button>
                </div>
            `;
        });
    }
}

window.salvarCategoria = async function() {
    const nome = document.getElementById('nome-cat').value;
    const arquivoFoto = document.getElementById('foto-cat-file').files[0];
    const msg = document.getElementById('msg-cat');

    if(!nome) { alert('Dê um nome para a categoria.'); return; }
    msg.innerText = "⏳ Criando categoria...";
    msg.style.color = "#e67e22";

    let urlFinalFoto = null;
    if(arquivoFoto) {
        const ext = arquivoFoto.name.split('.').pop();
        const nomeUnico = `cat_${idDaLojaLogada}_${Date.now()}.${ext}`;
        const { error: uploadError } = await db.storage.from('categorias').upload(nomeUnico, arquivoFoto);
        if(!uploadError) {
            const { data } = db.storage.from('categorias').getPublicUrl(nomeUnico);
            urlFinalFoto = data.publicUrl;
        }
    }

    const { error } = await db.from('categorias').insert([{ loja_id: idDaLojaLogada, nome: nome, imagem_url: urlFinalFoto }]);
    if(!error) {
        msg.innerText = "✅ Categoria criada!";
        msg.style.color = "#2ed573";
        document.getElementById('nome-cat').value = '';
        document.getElementById('foto-cat-file').value = '';
        carregarCategoriasAdmin();
        setTimeout(() => msg.innerText='', 3000);
    } else { msg.innerText = "❌ Erro ao criar."; }
}

window.removerCategoria = async function(id) {
    if(confirm('Tem certeza? Os produtos dessa categoria ficarão "Sem grupo".')) {
        await db.from('categorias').delete().eq('id', id);
        carregarCategoriasAdmin();
        carregarProdutosAdmin(); 
    }
}

async function carregarProdutosAdmin() {
    const { data: produtos, error } = await db.from('produtos').select('*').eq('loja_id', idDaLojaLogada).order('created_at', { ascending: false });
    const listaHTML = document.getElementById('lista-produtos-admin');
    listaHTML.innerHTML = '';

    if (error || produtos.length === 0) { listaHTML.innerHTML = '<p style="text-align:center; padding:20px;">Cardápio vazio.</p>'; return; }

    produtosCarregadosAdmin = produtos; 

    produtos.forEach((produto) => {
        let precoFormatado = Number(produto.preco).toFixed(2).replace('.', ','); 
        let foto = produto.imagem_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100&auto=format&fit=crop';
        
        let nomeCat = "Sem Grupo";
        if(produto.categoria_id) {
            let catObj = categoriasCarregadasAdmin.find(c => c.id === produto.categoria_id);
            if(catObj) nomeCat = catObj.nome;
        }

        listaHTML.innerHTML += `
            <div class="produto-item">
                <img src="${foto}" class="mini-foto-prod">
                <div class="produto-info">
                    <span class="cat-tag">${nomeCat}</span><br>
                    <strong>${produto.nome}</strong>
                    <small>R$ ${precoFormatado}</small>
                </div>
                <div class="btn-acoes">
                    <button class="btn-pequeno btn-editar" onclick="carregarDadosEdicao('${produto.id}')">Editar</button>
                    <button class="btn-pequeno btn-remover" onclick="removerProduto('${produto.id}')">Excluir</button>
                </div>
            </div>
        `;
    });
}

window.carregarDadosEdicao = function(id) {
    const prod = produtosCarregadosAdmin.find(p => p.id === id);
    if(!prod) return;

    document.getElementById('titulo-form-produto').innerText = "✏️ Editar Produto";
    document.getElementById('edit-prod-id').value = prod.id;
    document.getElementById('cat-prod').value = prod.categoria_id || ''; 
    document.getElementById('nome-prod').value = prod.nome;
    document.getElementById('desc-prod').value = prod.descricao || '';
    
    // Traz o preço e os adicionais com vírgula para editar
    document.getElementById('preco-prod').value = Number(prod.preco).toFixed(2).replace('.', ',');
    document.getElementById('ingredientes-prod').value = (prod.ingredientes || []).join(', ');
    
    // Adicionais com PONTO E VÍRGULA e preços com VÍRGULA
    document.getElementById('adicionais-prod').value = (prod.adicionais || []).map(a => `${a.nome}:${Number(a.preco).toFixed(2).replace('.', ',')}`).join('; ');

    let btnSalvar = document.getElementById('btn-salvar-prod');
    btnSalvar.innerText = "Atualizar Produto";
    btnSalvar.style.backgroundColor = "#eccc68";
    btnSalvar.style.color = "#2f3542";
    document.getElementById('btn-cancelar-edit').style.display = "block";
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.cancelarEdicao = function() {
    document.getElementById('titulo-form-produto').innerText = "+ Adicionar Novo Produto";
    document.getElementById('edit-prod-id').value = "";
    document.getElementById('cat-prod').value = "";
    document.getElementById('nome-prod').value = "";
    document.getElementById('desc-prod').value = "";
    document.getElementById('preco-prod').value = "";
    document.getElementById('ingredientes-prod').value = "";
    document.getElementById('adicionais-prod').value = "";
    document.getElementById('foto-prod-file').value = "";

    let btnSalvar = document.getElementById('btn-salvar-prod');
    btnSalvar.innerText = "Criar Produto no Cardápio";
    btnSalvar.style.backgroundColor = "#2ed573";
    btnSalvar.style.color = "white";
    document.getElementById('btn-cancelar-edit').style.display = "none";
}

async function salvarProduto() {
    const editId = document.getElementById('edit-prod-id').value; 
    const catId = document.getElementById('cat-prod').value; 
    const nome = document.getElementById('nome-prod').value;
    const desc = document.getElementById('desc-prod').value;
    
    let precoBruto = document.getElementById('preco-prod').value.replace(',', '.');
    const preco = parseFloat(precoBruto);
    
    const ingRaw = document.getElementById('ingredientes-prod').value;
    const arrayIngredientes = ingRaw ? ingRaw.split(',').map(i => i.trim()).filter(i => i) : [];

    // LÓGICA ATUALIZADA: Agora ele divide por PONTO E VÍRGULA (;)
    const adicRaw = document.getElementById('adicionais-prod').value;
    const arrayAdicionais = adicRaw ? adicRaw.split(';').map(item => {
        let partes = item.split(':');
        if(partes.length < 2) return null;
        let precoAdic = partes[1].trim().replace(',', '.'); // Converte vírgula para ponto no BD
        return { nome: partes[0].trim(), preco: parseFloat(precoAdic) || 0 };
    }).filter(i => i && i.nome) : [];

    const arquivoFoto = document.getElementById('foto-prod-file').files[0];
    const msg = document.getElementById('msg-salvar-prod');

    if (!nome || isNaN(preco)) { alert("Preencha Nome e um Preço válido."); return; }
    
    msg.innerText = editId ? "⏳ Atualizando..." : "⏳ Criando produto...";
    msg.style.color = "#e67e22";

    let urlFinalFoto = null;
    if(arquivoFoto) {
        msg.innerText = "⏳ Enviando foto...";
        const extensao = arquivoFoto.name.split('.').pop();
        const nomeUnico = `prod_${idDaLojaLogada}_${Date.now()}.${extensao}`;
        const { error: uploadError } = await db.storage.from('produtos').upload(nomeUnico, arquivoFoto);
        if(!uploadError) {
            const { data: publicUrl } = db.storage.from('produtos').getPublicUrl(nomeUnico);
            urlFinalFoto = publicUrl.publicUrl;
        }
    }

    let dadosBanco = { 
        nome: nome, 
        descricao: desc, 
        preco: preco,
        ingredientes: arrayIngredientes,
        adicionais: arrayAdicionais,
        categoria_id: catId ? catId : null 
    };

    if(urlFinalFoto) dadosBanco.imagem_url = urlFinalFoto; 

    let erroBanco;
    if(editId) {
        const { error } = await db.from('produtos').update(dadosBanco).eq('id', editId);
        erroBanco = error;
    } else {
        dadosBanco.loja_id = idDaLojaLogada;
        const { error } = await db.from('produtos').insert([dadosBanco]);
        erroBanco = error;
    }

    if (!erroBanco) {
        msg.innerText = editId ? "✅ Produto Atualizado!" : "✅ Produto Adicionado!";
        msg.style.color = "#2ed573";
        cancelarEdicao(); 
        carregarProdutosAdmin();
        setTimeout(() => msg.innerText='', 3000);
    } else { msg.innerText = "❌ Erro ao salvar."; }
}

async function removerProduto(idProduto) {
    if(confirm("Excluir este produto? Ele será apagado do cardápio.")) {
        await db.from('produtos').delete().eq('id', idProduto);
        carregarProdutosAdmin();
    }
}

window.fazerUploadFotoCapa = async function() {
    const inputArquivo = document.getElementById('foto-loja-file');
    const msg = document.getElementById('msg-upload-capa');
    if (inputArquivo.files.length === 0) { alert("Selecione uma foto."); return; }
    msg.innerText = "⏳";
    const arquivo = inputArquivo.files[0];
    const nomeArquivo = `capa_${idDaLojaLogada}_${Date.now()}.${arquivo.name.split('.').pop()}`;
    const { error: uploadError } = await db.storage.from('logos').upload(nomeArquivo, arquivo);
    if (!uploadError) {
        const { data } = db.storage.from('logos').getPublicUrl(nomeArquivo);
        await db.from('lojas').update({ logo_url: data.publicUrl }).eq('id', idDaLojaLogada);
        msg.innerText = "✅";
        setTimeout(() => msg.innerText='', 3000);
    } else { msg.innerText = "❌ Erro."; }
}

window.salvarConfiguracoes = async function() {
    let taxaBruta = document.getElementById('taxa-entrega-admin').value.replace(',', '.');
    const novaTaxa = parseFloat(taxaBruta) || 0;
    const novoPix = document.getElementById('pix-admin').value;
    
    await db.from('lojas').update({ taxa_entrega: novaTaxa, chave_pix: novoPix }).eq('id', idDaLojaLogada);
    alert("Taxa e Chave PIX atualizadas com sucesso!");
}

window.sair = async function() { await db.auth.signOut(); window.location.href = "index.html"; }
verificarSessao();