const supabaseUrl = 'https://eyslsyyctmokrbuwoprk.supabase.co';
const supabaseKey = 'sb_publishable_t9cAvHh2w-VWP3zxwSndmA_x0FPqsM1';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let carrinho = [];
let dadosLoja = {};

const urlParams = new URLSearchParams(window.location.search);
const lojaSlug = urlParams.get('loja');

async function carregarLoja() {
    if (!lojaSlug) { document.getElementById('nome-loja').innerText = "Loja inválida."; return; }

    const { data: loja, error } = await db.from('lojas').select('*').eq('slug', lojaSlug).eq('ativa', true).single();

    if (error || !loja) { document.getElementById('nome-loja').innerText = "Loja não encontrada."; return; }

    dadosLoja = loja;
    document.getElementById('nome-loja').innerText = dadosLoja.nome;
    
    if(loja.logo_url) {
        document.getElementById('header-loja-bg').style.backgroundImage = `url('${loja.logo_url}')`;
    }
    
    let taxa = Number(dadosLoja.taxa_entrega);
    document.getElementById('taxa-modal').innerText = taxa.toFixed(2);
    
    carregarProdutos(dadosLoja.id);
}

// Renderiza produtos com foto à ESQUERDA
async function carregarProdutos(idDaLoja) {
    const { data: produtos, error } = await db.from('produtos').select('*').eq('loja_id', idDaLoja).eq('disponivel', true);
    const listaHTML = document.getElementById('lista-produtos');
    listaHTML.innerHTML = '';

    if (error || produtos.length === 0) {
        listaHTML.innerHTML = '<p style="text-align:center; padding:20px;">Nenhum produto cadastrado.</p>';
        return;
    }

    produtos.forEach((produto) => {
        let preco = Number(produto.preco);
        // Foto genérica de comida se o lojista não enviar uma
        let foto = produto.imagem_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100&auto=format&fit=crop';
        
        // MUDANÇA AQUI: Layout atualizado com a foto à esquerda
        listaHTML.innerHTML += `
            <div class="produto-card">
                <img src="${foto}" alt="Foto ${produto.nome}" class="produto-img">
                <div class="produto-info-lado">
                    <div class="produto-textos">
                        <h3>${produto.nome}</h3>
                        <p>${produto.descricao || ''}</p>
                        <strong>R$ ${preco.toFixed(2)}</strong>
                    </div>
                    <button class="btn-add" onclick="adicionarAoCarrinho('${produto.nome}', ${preco})">+ Add</button>
                </div>
            </div>
        `;
    });
}

// Lógica Carrinho (mantida)
window.adicionarAoCarrinho = function(nome, preco) {
    carrinho.push({ nome, preco });
    atualizarCarrinhoVisual();
}
window.removerDoCarrinho = function(index) {
    carrinho.splice(index, 1);
    atualizarCarrinhoVisual();
    renderizarItensNoModal();
}
function atualizarCarrinhoVisual() {
    let subtotal = carrinho.reduce((sum, item) => sum + item.preco, 0);
    document.getElementById('qtd-itens').innerText = carrinho.length;
    document.getElementById('total-barra').innerText = subtotal.toFixed(2);
    document.getElementById('subtotal-modal').innerText = subtotal.toFixed(2);
    let taxa = Number(dadosLoja.taxa_entrega || 0);
    let totalComTaxa = subtotal + taxa;
    document.getElementById('total-final-modal').innerText = carrinho.length === 0 ? "0.00" : totalComTaxa.toFixed(2);
}
function renderizarItensNoModal() {
    const listaModal = document.getElementById('itens-modal');
    listaModal.innerHTML = '';
    if (carrinho.length === 0) {
        listaModal.innerHTML = '<p style="text-align:center; padding:10px;">Vazio.</p>'; return;
    }
    carrinho.forEach((item, index) => {
        listaModal.innerHTML += `
            <div class="item-carrinho">
                <div><strong>1x ${item.nome}</strong> (R$ ${item.preco.toFixed(2)})</div>
                <button class="btn-remover-item" onclick="removerDoCarrinho(${index})">🗑️</button>
            </div>`;
    });
}
window.abrirModal = function() { renderizarItensNoModal(); document.getElementById('modal-carrinho').style.display = 'flex'; }
window.fecharModal = function() { document.getElementById('modal-carrinho').style.display = 'none'; }
window.onclick = function(event) { if (event.target === document.getElementById('modal-carrinho')) { fecharModal(); } }

window.finalizarPedido = function() {
    if (carrinho.length === 0) { return; }
    let mensagem = `*Novo Pedido - ${dadosLoja.nome}*\n\n`;
    let subtotal = 0;
    carrinho.forEach(item => {
        mensagem += `• 1x ${item.nome} (R$ ${item.preco.toFixed(2)})\n`;
        subtotal += item.preco;
    });
    let taxa = Number(dadosLoja.taxa_entrega);
    mensagem += `\n*TOTAL (com entrega): R$ ${(subtotal + taxa).toFixed(2)}*\n\n`;
    window.open(`https://wa.me/${dadosLoja.whatsapp}?text=${encodeURIComponent(mensagem)}`, '_blank');
}

carregarLoja();