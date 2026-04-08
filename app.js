const supabaseUrl = 'https://eyslsyyctmokrbuwoprk.supabase.co';
const supabaseKey = 'sb_publishable_t9cAvHh2w-VWP3zxwSndmA_x0FPqsM1';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let carrinho = []; // Agora guarda a configuração exata do item
let dadosLoja = {};
let produtosCarregados = [];
let precoBaseModalAtual = 0; // Guarda o preço base para calcular os extras em tempo real

const urlParams = new URLSearchParams(window.location.search);
const lojaSlug = urlParams.get('loja');

async function carregarLoja() {
    if (!lojaSlug) return;
    const { data: loja } = await db.from('lojas').select('*').eq('slug', lojaSlug).eq('ativa', true).single();
    if (!loja) return;

    dadosLoja = loja;
    document.getElementById('nome-loja').innerText = dadosLoja.nome;
    if(loja.logo_url) document.getElementById('header-loja-bg').style.backgroundImage = `url('${loja.logo_url}')`;
    document.getElementById('taxa-modal').innerText = Number(dadosLoja.taxa_entrega).toFixed(2);
    carregarProdutos(dadosLoja.id);
}

async function carregarProdutos(idDaLoja) {
    const { data: produtos } = await db.from('produtos').select('*').eq('loja_id', idDaLoja).eq('disponivel', true);
    const listaHTML = document.getElementById('lista-produtos');
    listaHTML.innerHTML = '';

    if (!produtos || produtos.length === 0) { listaHTML.innerHTML = '<p style="text-align:center;">Cardápio vazio.</p>'; return; }

    produtosCarregados = produtos; 

    produtos.forEach((produto, index) => {
        let preco = Number(produto.preco);
        let foto = produto.imagem_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100&auto=format&fit=crop';
        
        listaHTML.innerHTML += `
            <div class="produto-card" id="card-${produto.id}" onclick="abrirDetalhe(${index})">
                <img src="${foto}" class="produto-img">
                <div class="produto-info-lado">
                    <div class="produto-textos">
                        <h3>${produto.nome}</h3>
                        <p>${produto.descricao || ''}</p>
                        <strong>R$ ${preco.toFixed(2)}</strong>
                    </div>
                    <div class="controle-add">
                        <button class="btn-add" id="btn-${produto.id}" onclick="event.stopPropagation(); cliqueRapidoCard('${produto.id}', '${produto.nome}', ${preco})">+</button>
                        <span class="qtd-no-card" id="qtd-${produto.id}"></span>
                    </div>
                </div>
            </div>
        `;
    });
}

// === LÓGICA DO MODAL (Monta as caixinhas e soma preço ao vivo) ===
window.abrirDetalhe = function(index) {
    const prod = produtosCarregados[index];
    precoBaseModalAtual = Number(prod.preco);
    
    document.getElementById('detalhe-foto').src = prod.imagem_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100&auto=format&fit=crop';
    document.getElementById('detalhe-nome').innerText = prod.nome;
    document.getElementById('detalhe-desc').innerText = prod.descricao || '';
    
    // Monta as opções dinamicamente
    let areaOpcoes = document.getElementById('area-ingredientes');
    areaOpcoes.innerHTML = '';

    // Ingredientes (Vêm marcados por padrão)
    let ingredientes = prod.ingredientes || [];
    if (ingredientes.length > 0) {
        let htmlIng = `<div class="titulo-opcoes">Retirar Ingredientes</div><ul class="lista-opcoes">`;
        ingredientes.forEach(ing => {
            htmlIng += `
                <li><label>
                    <div class="label-esquerda"><input type="checkbox" class="check-ingrediente" value="${ing}" checked> ${ing}</div>
                </label></li>`;
        });
        htmlIng += `</ul>`;
        areaOpcoes.innerHTML += htmlIng;
    }

    // Adicionais Pagos (Vêm desmarcados)
    let adicionais = prod.adicionais || [];
    if (adicionais.length > 0) {
        let htmlAdic = `<div class="titulo-opcoes">Turbine seu Pedido (Opcional)</div><ul class="lista-opcoes">`;
        adicionais.forEach(adic => {
            htmlAdic += `
                <li><label>
                    <div class="label-esquerda"><input type="checkbox" class="check-extra" value="${adic.nome}" data-preco="${adic.preco}" onchange="recalcularPrecoModal()"> + ${adic.nome}</div>
                    <span class="preco-extra">+ R$ ${Number(adic.preco).toFixed(2)}</span>
                </label></li>`;
        });
        htmlAdic += `</ul>`;
        areaOpcoes.innerHTML += htmlAdic;
    }

    recalcularPrecoModal(); // Calcula o valor inicial

    document.getElementById('btn-add-detalhe-click').onclick = function() { processarModalEAdicionar(prod); };
    document.getElementById('modal-detalhe').style.display = 'flex';
}

window.fecharDetalhe = function() { document.getElementById('modal-detalhe').style.display = 'none'; }

// Função chamada sempre que o cliente marca um adicional no modal
window.recalcularPrecoModal = function() {
    let total = precoBaseModalAtual;
    document.querySelectorAll('.check-extra:checked').forEach(chk => {
        total += parseFloat(chk.dataset.preco);
    });
    document.getElementById('detalhe-preco').innerText = `R$ ${total.toFixed(2)}`;
}

// Lê o modal e manda pro carrinho
function processarModalEAdicionar(prod) {
    let removidos = [];
    document.querySelectorAll('.check-ingrediente:not(:checked)').forEach(chk => removidos.push(chk.value));

    let extras = [];
    document.querySelectorAll('.check-extra:checked').forEach(chk => {
        extras.push({ nome: chk.value, preco: parseFloat(chk.dataset.preco) });
    });

    adicionarAoCarrinho(prod.id, prod.nome, precoBaseModalAtual, removidos, extras);
    fecharDetalhe();
}

// Clique rápido no cartão (Adiciona versão padrão sem extras)
window.cliqueRapidoCard = function(id, nome, preco) {
    adicionarAoCarrinho(id, nome, preco, [], []);
}


// === LÓGICA DO CARRINHO INTELIGENTE ===
window.adicionarAoCarrinho = function(id, nome, precoBase, removidos, extras) {
    // Cria uma "Assinatura Única" (Para não misturar "Pizza" com "Pizza sem cebola")
    let idUnico = id + JSON.stringify(removidos) + JSON.stringify(extras);
    
    let itemExistente = carrinho.find(item => item.idUnico === idUnico);
    
    let precoExtras = extras.reduce((sum, ext) => sum + ext.preco, 0);
    let precoFinalItem = precoBase + precoExtras;

    if (itemExistente) {
        itemExistente.qtd += 1;
    } else {
        carrinho.push({ 
            idProduto: id, 
            idUnico: idUnico, 
            nome: nome, 
            precoFinal: precoFinalItem, 
            removidos: removidos, 
            extras: extras, 
            qtd: 1 
        });
    }
    atualizarCarrinhoVisual();
}

window.removerDoCarrinho = function(idUnico) {
    let index = carrinho.findIndex(item => item.idUnico === idUnico);
    if(index > -1) {
        if(carrinho[index].qtd > 1) {
            carrinho[index].qtd -= 1; // Se tiver 2, diminui pra 1
        } else {
            carrinho.splice(index, 1); // Se tiver 1, exclui
        }
    }
    atualizarCarrinhoVisual();
    renderizarItensNoModal();
}

function atualizarCarrinhoVisual() {
    let subtotal = carrinho.reduce((sum, item) => sum + (item.precoFinal * item.qtd), 0);
    let totalItens = carrinho.reduce((sum, item) => sum + item.qtd, 0);

    document.getElementById('qtd-itens').innerText = totalItens;
    document.getElementById('total-barra').innerText = subtotal.toFixed(2);
    document.getElementById('subtotal-modal').innerText = subtotal.toFixed(2);
    
    let taxa = Number(dadosLoja.taxa_entrega || 0);
    document.getElementById('total-final-modal').innerText = carrinho.length === 0 ? "0.00" : (subtotal + taxa).toFixed(2);

    // Pinta os cards na vitrine
    produtosCarregados.forEach(prod => {
        let card = document.getElementById(`card-${prod.id}`);
        let txtQtd = document.getElementById(`qtd-${prod.id}`);
        
        // Quantos itens desse produto tem no carrinho (independente da personalização)
        let qtdDesteProduto = carrinho.filter(c => c.idProduto === prod.id).reduce((s, c) => s + c.qtd, 0);

        if (qtdDesteProduto > 0) {
            card.classList.add("card-selecionado");
            txtQtd.innerText = `${qtdDesteProduto} un.`;
        } else {
            if(card) {
                card.classList.remove("card-selecionado");
                txtQtd.innerText = "";
            }
        }
    });
}

function renderizarItensNoModal() {
    const listaModal = document.getElementById('itens-modal');
    listaModal.innerHTML = '';
    if (carrinho.length === 0) { listaModal.innerHTML = '<p style="text-align:center;">Vazio.</p>'; return; }
    
    carrinho.forEach((item) => {
        let subtotalItem = item.precoFinal * item.qtd;
        
        // Gera o texto explicativo das alterações (Ex: - Cebola, + Bacon)
        let textoDetalhes = '';
        if(item.removidos.length > 0) textoDetalhes += `Sem: ${item.removidos.join(', ')}<br>`;
        if(item.extras.length > 0) textoDetalhes += `Extra: ${item.extras.map(e => e.nome).join(', ')}`;

        listaModal.innerHTML += `
            <div class="item-carrinho">
                <div style="flex-grow: 1; padding-right: 15px;">
                    <strong>${item.qtd}x ${item.nome}</strong> (R$ ${(item.precoFinal).toFixed(2)}/un)
                    ${textoDetalhes ? `<span class="item-detalhes-texto">${textoDetalhes}</span>` : ''}
                </div>
                <div style="text-align: right;">
                    <strong style="display:block; margin-bottom: 5px;">R$ ${subtotalItem.toFixed(2)}</strong>
                    <button class="btn-remover-item" onclick="removerDoCarrinho('${item.idUnico}')">- Tirar 1</button>
                </div>
            </div>`;
    });
}

window.abrirModal = function() { renderizarItensNoModal(); document.getElementById('modal-carrinho').style.display = 'flex'; }
window.fecharModal = function() { document.getElementById('modal-carrinho').style.display = 'none'; }
window.onclick = function(event) { 
    if (event.target === document.getElementById('modal-carrinho')) fecharModal(); 
    if (event.target === document.getElementById('modal-detalhe')) fecharDetalhe(); 
}

// === NOVO: FINALIZAR PEDIDO NO ZAP (COM PIX E DIVISÓRIAS) ===
window.finalizarPedido = function() {
    if (carrinho.length === 0) return;
    
    let mensagem = `*NOVO PEDIDO - ${dadosLoja.nome}* 🛵\n`;
    mensagem += `--------------------------------------\n\n`;
    
    let subtotal = 0;
    
    carrinho.forEach((item, index) => {
        let subtotalItem = item.precoFinal * item.qtd;
        mensagem += `*Item ${index + 1}: ${item.qtd}x ${item.nome}* (R$ ${subtotalItem.toFixed(2)})\n`;
        
        // Destacando as Retiradas e Adicionais para a cozinha
        if(item.removidos.length > 0) {
            mensagem += `   🚫 *ATENÇÃO - RETIRAR:* ${item.removidos.join(', ')}\n`;
        }
        if(item.extras.length > 0) {
            mensagem += `   ➕ *ADICIONAIS:* ${item.extras.map(e => e.nome).join(', ')}\n`;
        }
        
        mensagem += `\n`; 
        subtotal += subtotalItem;
    });
    
    let taxa = Number(dadosLoja.taxa_entrega);
    let totalFinal = subtotal + taxa;
    
    mensagem += `--------------------------------------\n`;
    mensagem += `*Subtotal:* R$ ${subtotal.toFixed(2)}\n`;
    mensagem += `*Taxa de Entrega:* R$ ${taxa.toFixed(2)}\n`;
    mensagem += `*TOTAL A PAGAR: R$ ${totalFinal.toFixed(2)}*\n`;
    mensagem += `--------------------------------------\n\n`;
    
    // Mostra o PIX se o lojista tiver cadastrado
    if (dadosLoja.chave_pix) {
        mensagem += `💳 *Pagamento via PIX*\n`;
        mensagem += `Chave: *${dadosLoja.chave_pix}*\n\n`;
    }
    
    mensagem += `📍 _Por favor, envie seu endereço completo (Rua, Número, Bairro e Referência) aqui embaixo para confirmarmos o pedido!_`;
    
    window.open(`https://wa.me/${dadosLoja.whatsapp}?text=${encodeURIComponent(mensagem)}`, '_blank');
}

carregarLoja();