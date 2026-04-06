const supabaseUrl = 'https://eyslsyyctmokrbuwoprk.supabase.co';
const supabaseKey = 'sb_publishable_t9cAvHh2w-VWP3zxwSndmA_x0FPqsM1';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let carrinho = [];
let dadosLoja = {};

const urlParams = new URLSearchParams(window.location.search);
const lojaSlug = urlParams.get('loja');

async function carregarLoja() {
    if (!lojaSlug) {
        document.getElementById('nome-loja').innerText = "Loja não informada.";
        return;
    }

    const { data: loja, error } = await db.from('lojas').select('*').eq('slug', lojaSlug).eq('ativa', true).single();

    if (error || !loja) {
        document.getElementById('nome-loja').innerText = "Loja não encontrada.";
        return;
    }

    dadosLoja = loja;
    document.getElementById('nome-loja').innerText = dadosLoja.nome;
    
    if(loja.logo_url) {
        document.getElementById('header-loja-bg').style.backgroundImage = `url('${loja.logo_url}')`;
    }
    
    let taxa = Number(dadosLoja.taxa_entrega);
    document.getElementById('taxa-modal').innerText = taxa.toFixed(2);
    
    carregarProdutos(dadosLoja.id);
}

async function carregarProdutos(idDaLoja) {
    const { data: produtos, error } = await db.from('produtos').select('*').eq('loja_id', idDaLoja).eq('disponivel', true);
    const listaHTML = document.getElementById('lista-produtos');
    listaHTML.innerHTML = '';

    if (error || produtos.length === 0) {
        listaHTML.innerHTML = '<p style="text-align:center;">Nenhum produto disponível.</p>';
        return;
    }

    produtos.forEach((produto) => {
        let preco = Number(produto.preco);
        listaHTML.innerHTML += `
            <div class="produto-card">
                <div class="produto-info">
                    <h3>${produto.nome}</h3>
                    <p>${produto.descricao || ''}</p>
                    <strong>R$ ${preco.toFixed(2)}</strong>
                </div>
                <button class="btn-add" onclick="adicionarAoCarrinho('${produto.nome}', ${preco})">+ Add</button>
            </div>
        `;
    });
}

window.adicionarAoCarrinho = function(nome, preco) {
    carrinho.push({ nome, preco });
    atualizarCarrinhoVisual();
    // ALERTA REMOVIDO: O produto entra direto no carrinho agora!
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
    
    if (carrinho.length === 0) {
        document.getElementById('total-final-modal').innerText = "0.00";
    } else {
        document.getElementById('total-final-modal').innerText = totalComTaxa.toFixed(2);
    }
}

function renderizarItensNoModal() {
    const listaModal = document.getElementById('itens-modal');
    listaModal.innerHTML = '';

    if (carrinho.length === 0) {
        listaModal.innerHTML = '<p style="text-align:center; color:#747d8c;">Seu carrinho está vazio.</p>';
        return;
    }

    carrinho.forEach((item, index) => {
        listaModal.innerHTML += `
            <div class="item-carrinho">
                <div>
                    <div class="item-nome">1x ${item.nome}</div>
                    <div class="item-preco">R$ ${item.preco.toFixed(2)}</div>
                </div>
                <button class="btn-remover-item" onclick="removerDoCarrinho(${index})">🗑️ Excluir</button>
            </div>
        `;
    });
}

window.abrirModal = function() {
    renderizarItensNoModal();
    document.getElementById('modal-carrinho').style.display = 'flex';
}

window.fecharModal = function() {
    document.getElementById('modal-carrinho').style.display = 'none';
}

// NOVA FUNÇÃO: Fechar modal ao clicar fora dele
window.onclick = function(event) {
    const modal = document.getElementById('modal-carrinho');
    if (event.target === modal) {
        fecharModal();
    }
}

window.finalizarPedido = function() {
    if (carrinho.length === 0) { alert("Adicione itens para finalizar!"); return; }

    let mensagem = `*Novo Pedido - ${dadosLoja.nome}* 🛵\n\n`;
    let subtotal = 0;

    carrinho.forEach(item => {
        mensagem += `• 1x ${item.nome} - R$ ${item.preco.toFixed(2)}\n`;
        subtotal += item.preco;
    });

    let taxa = Number(dadosLoja.taxa_entrega);
    let total = subtotal + taxa;

    mensagem += `\n*Subtotal:* R$ ${subtotal.toFixed(2)}\n`;
    mensagem += `*Taxa de Entrega:* R$ ${taxa.toFixed(2)}\n`;
    mensagem += `*TOTAL:* R$ ${total.toFixed(2)}\n\n`;
    mensagem += `_Envie o seu endereço aqui em baixo para calcularmos o tempo de entrega!_`;

    let urlWhatsApp = `https://wa.me/${dadosLoja.whatsapp}?text=${encodeURIComponent(mensagem)}`;
    window.open(urlWhatsApp, '_blank');
}

carregarLoja();