const supabaseUrl = 'https://eyslsyyctmokrbuwoprk.supabase.co';
const supabaseKey = 'sb_publishable_t9cAvHh2w-VWP3zxwSndmA_x0FPqsM1';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let idDaLojaLogada = null;
let produtosCarregadosAdmin = []; // Guarda na memória para facilitar a edição

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
    
    // Preenche as configurações da loja
    document.getElementById('taxa-entrega-admin').value = Number(loja.taxa_entrega).toFixed(2);
    document.getElementById('pix-admin').value = loja.chave_pix || '';

    const urlBase = window.location.href.split('admin.html')[0];
    document.getElementById('btn-ver-loja').href = `${urlBase}loja.html?loja=${loja.slug}`;

    carregarProdutosAdmin();
}

async function carregarProdutosAdmin() {
    const { data: produtos, error } = await db.from('produtos').select('*').eq('loja_id', idDaLojaLogada).order('created_at', { ascending: false });
    const listaHTML = document.getElementById('lista-produtos-admin');
    listaHTML.innerHTML = '';

    if (error || produtos.length === 0) { listaHTML.innerHTML = '<p style="text-align:center; padding:20px;">Cardápio vazio.</p>'; return; }

    produtosCarregadosAdmin = produtos; // Salva para a função de edição

    produtos.forEach((produto) => {
        let preco = Number(produto.preco);
        let foto = produto.imagem_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100&auto=format&fit=crop';
        
        listaHTML.innerHTML += `
            <div class="produto-item">
                <img src="${foto}" class="mini-foto-prod">
                <div class="produto-info">
                    <strong>${produto.nome}</strong>
                    <small>R$ ${preco.toFixed(2)}</small>
                </div>
                <div class="btn-acoes">
                    <button class="btn-pequeno btn-editar" onclick="carregarDadosEdicao('${produto.id}')">Editar</button>
                    <button class="btn-pequeno btn-remover" onclick="removerProduto('${produto.id}')">Excluir</button>
                </div>
            </div>
        `;
    });
}

// === LÓGICA DE EDIÇÃO ===
window.carregarDadosEdicao = function(id) {
    const prod = produtosCarregadosAdmin.find(p => p.id === id);
    if(!prod) return;

    document.getElementById('titulo-form-produto').innerText = "✏️ Editar Produto";
    document.getElementById('edit-prod-id').value = prod.id;
    document.getElementById('nome-prod').value = prod.nome;
    document.getElementById('desc-prod').value = prod.descricao || '';
    document.getElementById('preco-prod').value = prod.preco;

    // Transforma Arrays de volta para texto separado por vírgulas
    document.getElementById('ingredientes-prod').value = (prod.ingredientes || []).join(', ');
    document.getElementById('adicionais-prod').value = (prod.adicionais || []).map(a => `${a.nome}:${a.preco}`).join(', ');

    // Muda o visual dos botões
    let btnSalvar = document.getElementById('btn-salvar-prod');
    btnSalvar.innerText = "Atualizar Produto";
    btnSalvar.style.backgroundColor = "#eccc68";
    btnSalvar.style.color = "#2f3542";
    document.getElementById('btn-cancelar-edit').style.display = "block";

    // Rola a tela pra cima suavemente
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.cancelarEdicao = function() {
    document.getElementById('titulo-form-produto').innerText = "+ Adicionar Novo Produto";
    document.getElementById('edit-prod-id').value = "";
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

// === SALVAR (CRIAÇÃO E EDIÇÃO) ===
async function salvarProduto() {
    const editId = document.getElementById('edit-prod-id').value; // Se tiver ID, é edição
    const nome = document.getElementById('nome-prod').value;
    const desc = document.getElementById('desc-prod').value;
    const preco = document.getElementById('preco-prod').value;
    
    const ingRaw = document.getElementById('ingredientes-prod').value;
    const arrayIngredientes = ingRaw ? ingRaw.split(',').map(i => i.trim()).filter(i => i) : [];

    const adicRaw = document.getElementById('adicionais-prod').value;
    const arrayAdicionais = adicRaw ? adicRaw.split(',').map(item => {
        let partes = item.split(':');
        return { nome: partes[0].trim(), preco: parseFloat(partes[1]) || 0 };
    }).filter(i => i.nome) : [];

    const arquivoFoto = document.getElementById('foto-prod-file').files[0];
    const msg = document.getElementById('msg-salvar-prod');

    if (!nome || !preco) { alert("Preencha Nome e Preço."); return; }
    
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
        preco: parseFloat(preco),
        ingredientes: arrayIngredientes,
        adicionais: arrayAdicionais
    };

    // Só altera a imagem se o usuário tiver feito upload de uma nova
    if(urlFinalFoto) dadosBanco.imagem_url = urlFinalFoto; 

    let erroBanco;

    if(editId) {
        // Atualiza produto existente
        const { error } = await db.from('produtos').update(dadosBanco).eq('id', editId);
        erroBanco = error;
    } else {
        // Cria produto novo
        dadosBanco.loja_id = idDaLojaLogada;
        const { error } = await db.from('produtos').insert([dadosBanco]);
        erroBanco = error;
    }

    if (!erroBanco) {
        msg.innerText = editId ? "✅ Produto Atualizado!" : "✅ Produto Adicionado!";
        msg.style.color = "#2ed573";
        cancelarEdicao(); // Limpa o formulário e volta ao normal
        carregarProdutosAdmin();
    } else {
        msg.innerText = "❌ Erro ao salvar.";
    }
}

async function removerProduto(idProduto) {
    if(confirm("Excluir este produto? Ele será apagado do cardápio.")) {
        await db.from('produtos').delete().eq('id', idProduto);
        carregarProdutosAdmin();
    }
}

// === CONFIGURAÇÕES DA LOJA ===
window.fazerUploadFotoCapa = async function() {
    const inputArquivo = document.getElementById('foto-loja-file');
    const msg = document.getElementById('msg-upload-capa');
    if (inputArquivo.files.length === 0) { alert("Selecione uma foto."); return; }
    msg.innerText = "⏳ Enviando capa...";
    const arquivo = inputArquivo.files[0];
    const nomeArquivo = `capa_${idDaLojaLogada}_${Date.now()}.${arquivo.name.split('.').pop()}`;
    const { error: uploadError } = await db.storage.from('logos').upload(nomeArquivo, arquivo);
    if (!uploadError) {
        const { data } = db.storage.from('logos').getPublicUrl(nomeArquivo);
        await db.from('lojas').update({ logo_url: data.publicUrl }).eq('id', idDaLojaLogada);
        msg.innerText = "✅ Capa atualizada!";
    } else { msg.innerText = "❌ Erro."; }
}

// Salva Taxa e PIX juntos
window.salvarConfiguracoes = async function() {
    const novaTaxa = parseFloat(document.getElementById('taxa-entrega-admin').value) || 0;
    const novoPix = document.getElementById('pix-admin').value;
    
    await db.from('lojas').update({ taxa_entrega: novaTaxa, chave_pix: novoPix }).eq('id', idDaLojaLogada);
    alert("Taxa e Chave PIX atualizadas com sucesso!");
}

window.sair = async function() { await db.auth.signOut(); window.location.href = "index.html"; }
verificarSessao();