// 1. Inicializa o Supabase
const supabaseUrl = 'https://eyslsyyctmokrbuwoprk.supabase.co';
const supabaseKey = 'sb_publishable_t9cAvHh2w-VWP3zxwSndmA_x0FPqsM1';

// MUDANÇA CRÍTICA AQUI: Mudamos o nome da variável para 'db' para não conflitar com a biblioteca
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

// Variáveis globais
let carrinho = [];
let dadosLoja = {};

// 2. Pega o slug da loja pela URL (ex: ?loja=teste)
const urlParams = new URLSearchParams(window.location.search);
const lojaSlug = urlParams.get('loja');

async function carregarLoja() {
    if (!lojaSlug) {
        document.getElementById('nome-loja').innerText = "Link de loja inválido.";
        return;
    }

    // 3. Busca dados da Loja no Supabase usando o 'db'
    const { data: loja, error } = await db
        .from('lojas')
        .select('*')
        .eq('slug', lojaSlug)
        .eq('ativa', true)
        .single(); // Garante que retorna apenas um registro

    if (error || !loja) {
        console.error("Erro ao buscar loja:", error);
        document.getElementById('nome-loja').innerText = "Loja não encontrada ou inativa.";
        return;
    }

    dadosLoja = loja;
    document.getElementById('nome-loja').innerText = dadosLoja.nome;
    document.getElementById('taxa-entrega').innerText = Number(dadosLoja.taxa_entrega).toFixed(2);
    
    carregarProdutos(dadosLoja.id);
}

async function carregarProdutos(idDaLoja) {
    // 4. Busca os produtos no Supabase atrelados ao ID da loja usando o 'db'
    const { data: produtos, error } = await db
        .from('produtos')
        .select('*')
        .eq('loja_id', idDaLoja)
        .eq('disponivel', true);

    if (error) {
        console.error("Erro ao buscar produtos:", error);
        return;
    }

    const listaHTML = document.getElementById('lista-produtos');
    listaHTML.innerHTML = '';

    if (produtos.length === 0) {
        listaHTML.innerHTML = '<p style="text-align:center; padding: 20px;">Nenhum produto disponível no momento.</p>';
        return;
    }

    produtos.forEach((produto) => {
        let preco = Number(produto.preco);
        
        listaHTML.innerHTML += `
            <div class="produto">
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

// 5. Funções do Carrinho e WhatsApp
function adicionarAoCarrinho(nome, preco) {
    carrinho.push({ nome, preco });
    atualizarCarrinho();
}

function atualizarCarrinho() {
    let subtotal = carrinho.reduce((sum, item) => sum + item.preco, 0);
    let taxa = Number(dadosLoja.taxa_entrega);
    let total = subtotal + taxa;
    document.getElementById('total-carrinho').innerText = total.toFixed(2);
}

function finalizarPedido() {
    if (carrinho.length === 0) {
        alert("Seu carrinho está vazio!");
        return;
    }

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
    
    mensagem += `*Pagamento via PIX:*\n`;
    mensagem += `Chave: ${dadosLoja.chave_pix}\n\n`;
    mensagem += `_Envie o comprovante e seu endereço aqui em baixo para iniciarmos o preparo!_`;

    let urlWhatsApp = `https://wa.me/${dadosLoja.whatsapp}?text=${encodeURIComponent(mensagem)}`;
    window.open(urlWhatsApp, '_blank');
}

// Expõe as funções para os botões do HTML
window.adicionarAoCarrinho = adicionarAoCarrinho;
window.finalizarPedido = finalizarPedido;

// Inicia o carregamento
carregarLoja();