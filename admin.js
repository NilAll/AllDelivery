const supabaseUrl = 'https://eyslsyyctmokrbuwoprk.supabase.co';
const supabaseKey = 'sb_publishable_t9cAvHh2w-VWP3zxwSndmA_x0FPqsM1';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let idDaLojaLogada = null;

async function verificarSessao() {
    const { data: { session } } = await db.auth.getSession();
    if (!session) { window.location.href = "login.html"; return; }
    buscarLojaDoUsuario(session.user.id);
}

async function buscarLojaDoUsuario(userId) {
    const { data: loja, error } = await db.from('lojas').select('*').eq('user_id', userId).single();

    if (error || !loja) {
        document.getElementById('nome-loja-admin').innerText = "Erro: Loja não encontrada.";
        return;
    }

    idDaLojaLogada = loja.id;
    document.getElementById('nome-loja-admin').innerText = loja.nome;
    
    document.getElementById('taxa-entrega-admin').value = Number(loja.taxa_entrega).toFixed(2);

    const urlCompleta = `${window.location.origin}/loja.html?loja=${loja.slug}`;
    document.getElementById('url-loja').value = urlCompleta;
    document.getElementById('btn-ver-loja').href = urlCompleta;

    carregarProdutosAdmin();
}

async function carregarProdutosAdmin() {
    const { data: produtos, error } = await db.from('produtos').select('*').eq('loja_id', idDaLojaLogada).order('created_at', { ascending: false });
    const listaHTML = document.getElementById('lista-produtos-admin');
    listaHTML.innerHTML = '';

    if (error) { listaHTML.innerHTML = '<p>Erro ao buscar produtos.</p>'; return; }
    if (produtos.length === 0) { listaHTML.innerHTML = '<p style="text-align:center;">Nenhum produto cadastrado.</p>'; return; }

    produtos.forEach((produto) => {
        let preco = Number(produto.preco);
        listaHTML.innerHTML += `
            <div class="produto-item">
                <div class="produto-info">
                    <strong>${produto.nome}</strong>
                    <small>R$ ${preco.toFixed(2)}</small>
                </div>
                <button class="btn-remover" onclick="removerProduto('${produto.id}')">Excluir</button>
            </div>
        `;
    });
}

async function salvarProduto() {
    const nome = document.getElementById('nome-prod').value;
    const desc = document.getElementById('desc-prod').value;
    const preco = document.getElementById('preco-prod').value;

    if (!nome || !preco) { alert("Preencha o nome e o preço."); return; }

    const { error } = await db.from('produtos').insert([{ loja_id: idDaLojaLogada, nome: nome, descricao: desc, preco: parseFloat(preco) }]);

    if (!error) {
        document.getElementById('nome-prod').value = '';
        document.getElementById('desc-prod').value = '';
        document.getElementById('preco-prod').value = '';
        carregarProdutosAdmin();
    }
}

async function removerProduto(idProduto) {
    if(confirm("Excluir este produto?")) {
        const { error } = await db.from('produtos').delete().eq('id', idProduto);
        if (!error) carregarProdutosAdmin();
    }
}

window.fazerUploadFoto = async function() {
    const inputArquivo = document.getElementById('foto-loja-file');
    const msg = document.getElementById('msg-upload');
    const botao = document.getElementById('btn-upload');
    
    if (inputArquivo.files.length === 0) {
        msg.innerText = "Por favor, selecione uma foto primeiro!";
        msg.style.color = "#ff4757";
        return;
    }

    const arquivo = inputArquivo.files[0];
    msg.innerText = "⏳ Enviando foto... aguarde.";
    msg.style.color = "#e67e22";
    botao.disabled = true;

    const extensao = arquivo.name.split('.').pop();
    const nomeArquivo = `loja_${idDaLojaLogada}_${Date.now()}.${extensao}`;

    const { data: uploadData, error: uploadError } = await db.storage.from('logos').upload(nomeArquivo, arquivo);

    if (uploadError) {
        console.error("Erro no Upload:", uploadError);
        msg.innerText = "❌ Erro no envio: " + uploadError.message;
        msg.style.color = "#ff4757";
        botao.disabled = false;
        return;
    }

    const { data: publicUrlData } = db.storage.from('logos').getPublicUrl(nomeArquivo);
    const linkDaFoto = publicUrlData.publicUrl;

    const { error: dbError } = await db.from('lojas').update({ logo_url: linkDaFoto }).eq('id', idDaLojaLogada);

    if (dbError) {
        console.error("Erro no Banco de Dados:", dbError);
        msg.innerText = "❌ Erro do Banco: " + dbError.message; // Agora a tela avisa exatamente o erro
        msg.style.color = "#ff4757";
    } else {
        msg.innerText = "✅ Foto atualizada com sucesso!";
        msg.style.color = "#2ed573";
    }
    
    botao.disabled = false;
}

window.salvarTaxa = async function() {
    const novaTaxa = parseFloat(document.getElementById('taxa-entrega-admin').value);
    
    if (isNaN(novaTaxa) || novaTaxa < 0) {
        alert("Por favor, digite um valor de taxa válido.");
        return;
    }

    const { error } = await db.from('lojas').update({ taxa_entrega: novaTaxa }).eq('id', idDaLojaLogada);

    if (error) {
        alert("Erro ao salvar a taxa de entrega.");
    } else {
        alert("Taxa de entrega atualizada com sucesso!");
    }
}

window.copiarLink = function() {
    const inputLink = document.getElementById('url-loja');
    inputLink.select(); inputLink.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(inputLink.value);
    alert("Link copiado para a área de transferência!");
}

window.sair = async function() {
    await db.auth.signOut();
    window.location.href = "index.html"; 
}

window.salvarProduto = salvarProduto;
window.removerProduto = removerProduto;
verificarSessao();