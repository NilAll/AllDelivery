const supabaseUrl = 'https://eyslsyyctmokrbuwoprk.supabase.co';
const supabaseKey = 'sb_publishable_t9cAvHh2w-VWP3zxwSndmA_x0FPqsM1';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let idDaLojaLogada = null;

// Proteção da página
async function verificarSessao() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { window.location.href = "login.html"; return; }
    buscarLojaDoUsuario(session.user.id);
}

// Puxa dados da loja e gera links
async function buscarLojaDoUsuario(userId) {
    const { data: loja, error } = await db.from('lojas').select('*').eq('user_id', userId).single();

    if (error || !loja) {
        document.getElementById('nome-loja-admin').innerText = "Erro: Loja não encontrada.";
        return;
    }

    idDaLojaLogada = loja.id;
    document.getElementById('nome-loja-admin').innerText = loja.nome;
    
    // Preenche taxa atual
    document.getElementById('taxa-entrega-admin').value = Number(loja.taxa_entrega).toFixed(2);

    // Gera links (Correção para GitHub Pages mantida)
    const urlBase = window.location.href.split('admin.html')[0];
    const urlCompleta = `${urlBase}loja.html?loja=${loja.slug}`;
    document.getElementById('btn-ver-loja').href = urlCompleta;

    carregarProdutosAdmin();
}

// Lista produtos no painel com Miniatura
async function carregarProdutosAdmin() {
    const { data: produtos, error } = await db.from('produtos').select('*').eq('loja_id', idDaLojaLogada).order('created_at', { ascending: false });
    const listaHTML = document.getElementById('lista-produtos-admin');
    listaHTML.innerHTML = '';

    if (error) { listaHTML.innerHTML = '<p>Erro ao buscar produtos.</p>'; return; }
    if (produtos.length === 0) { listaHTML.innerHTML = '<p style="text-align:center; padding:20px;">Cardápio vazio.</p>'; return; }

    produtos.forEach((produto) => {
        let preco = Number(produto.preco);
        // Imagem padrão se o produto não tiver foto
        let foto = produto.imagem_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100&auto=format&fit=crop';
        
        listaHTML.innerHTML += `
            <div class="produto-item">
                <img src="${foto}" class="mini-foto-prod" alt="Foto ${produto.nome}">
                <div class="produto-info">
                    <strong>${produto.nome}</strong>
                    <small>R$ ${preco.toFixed(2)}</small>
                </div>
                <button class="btn-remover" onclick="removerProduto('${produto.id}')">Excluir</button>
            </div>
        `;
    });
}

// --- NOVO: SALVAR PRODUTO COM FOTO ---
async function salvarProduto() {
    const nome = document.getElementById('nome-prod').value;
    const desc = document.getElementById('desc-prod').value;
    const preco = document.getElementById('preco-prod').value;
    const arquivoFoto = document.getElementById('foto-prod-file').files[0]; // Pega a foto selecionada
    const msg = document.getElementById('msg-salvar-prod');

    if (!nome || !preco) { alert("Preencha Nome e Preço."); return; }
    
    msg.innerText = "⏳ Criando produto...";
    msg.style.color = "#e67e22";

    let urlFinalFoto = null;

    // Se tiver foto, faz o upload primeiro
    if(arquivoFoto) {
        msg.innerText = "⏳ Enviando foto do produto...";
        const extensao = arquivoFoto.name.split('.').pop();
        const nomeUnico = `prod_${idDaLojaLogada}_${Date.now()}.${extensao}`;
        
        // Sobe para o bucket 'produtos'
        const { data: uploadData, error: uploadError } = await db.storage
            .from('produtos')
            .upload(nomeUnico, arquivoFoto);

        if(!uploadError) {
            // Pega o link público
            const { data: publicUrl } = db.storage.from('produtos').getPublicUrl(nomeUnico);
            urlFinalFoto = publicUrl.publicUrl;
        } else {
            console.error("Erro upload foto produto:", uploadError);
        }
    }

    // Cria o produto no banco (com ou sem foto)
    const { error } = await db.from('produtos').insert([{ 
        loja_id: idDaLojaLogada, 
        nome: nome, 
        descricao: desc, 
        preco: parseFloat(preco),
        imagem_url: urlFinalFoto // Salva o link da foto
    }]);

    if (!error) {
        msg.innerText = "✅ Produto adicionado!";
        msg.style.color = "#2ed573";
        // Limpa campos
        document.getElementById('nome-prod').value = '';
        document.getElementById('desc-prod').value = '';
        document.getElementById('preco-prod').value = '';
        document.getElementById('foto-prod-file').value = ''; // Limpa o arquivo
        carregarProdutosAdmin();
    } else {
        msg.innerText = "❌ Erro ao salvar.";
        console.error(error);
    }
}

async function removerProduto(idProduto) {
    if(confirm("Excluir este produto?")) {
        const { error } = await db.from('produtos').delete().eq('id', idProduto);
        if (!error) carregarProdutosAdmin();
    }
}

// Upload Foto Capa (Lógica existente)
window.fazerUploadFotoCapa = async function() {
    const inputArquivo = document.getElementById('foto-loja-file');
    const msg = document.getElementById('msg-upload-capa');
    
    if (inputArquivo.files.length === 0) { alert("Selecione uma foto."); return; }
    const arquivo = inputArquivo.files[0];
    msg.innerText = "⏳ Enviando capa...";
    
    const extensao = arquivo.name.split('.').pop();
    const nomeArquivo = `capa_${idDaLojaLogada}_${Date.now()}.${extensao}`;

    const { data: uploadData, error: uploadError } = await db.storage.from('logos').upload(nomeArquivo, arquivo);

    if (!uploadError) {
        const { data: publicUrl } = db.storage.from('logos').getPublicUrl(nomeArquivo);
        const { error: dbError } = await db.from('lojas').update({ logo_url: publicUrl.publicUrl }).eq('id', idDaLojaLogada);
        if (!dbError) msg.innerText = "✅ Capa atualizada!";
    } else { msg.innerText = "❌ Erro no envio."; }
}

// Salvar Taxa
window.salvarTaxa = async function() {
    const novaTaxa = parseFloat(document.getElementById('taxa-entrega-admin').value);
    const { error } = await db.from('lojas').update({ taxa_entrega: novaTaxa }).eq('id', idDaLojaLogada);
    if (!error) alert("Taxa atualizada!");
}

window.sair = async function() { await db.auth.signOut(); window.location.href = "index.html"; }
verificarSessao();