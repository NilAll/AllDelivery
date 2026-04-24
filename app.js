const supabaseUrl = 'https://eyslsyyctmokrbuwoprk.supabase.co';
const supabaseKey = 'sb_publishable_t9cAvHh2w-VWP3zxwSndmA_x0FPqsM1';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

let carrinho = []; 
let dadosLoja = {};
let produtosCarregados = [];
let categoriasCarregadas = [];
let precoBaseModalAtual = 0; 
let filtroCategoriaAtivo = null;

const urlParams = new URLSearchParams(window.location.search);
const lojaSlug = urlParams.get('loja');

async function carregarLoja() {
    if (!lojaSlug) return;
    const { data: loja } = await db.from('lojas').select('*').eq('slug', lojaSlug).eq('ativa', true).single();
    if (!loja) return;

    dadosLoja = loja;
    document.getElementById('nome-loja').innerText = dadosLoja.nome;
    if(loja.logo_url) document.getElementById('header-loja-bg').style.backgroundImage = `url('${loja.logo_url}')`;
    document.getElementById('taxa-modal').innerText = Number(dadosLoja.taxa_entrega).toFixed(2).replace('.', ',');
    
    carregarCategorias(dadosLoja.id);
    carregarProdutos(dadosLoja.id);
}

async function carregarCategorias(idDaLoja) {
    const { data: categorias } = await db.from('categorias').select('*').eq('loja_id', idDaLoja).order('nome');
    const container = document.getElementById('container-categorias');
    const lista = document.getElementById('lista-categorias');

    if (categorias && categorias.length > 0) {
        categoriasCarregadas = categorias;
        container.style.display = 'block'; 
        lista.innerHTML = '';
        
        categorias.forEach(cat => {
            let foto = cat.imagem_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=300&auto=format&fit=crop';
            lista.innerHTML += `
                <div class="cat-card" style="background-image: url('${foto}')" onclick="filtrarPorCategoria('${cat.id}', '${cat.nome}')">
                    <div class="cat-nome">${cat.nome}</div>
                </div>
            `;
        });
    }
}

async function carregarProdutos(idDaLoja) {
    const { data: produtos } = await db.from('produtos').select('*').eq('loja_id', idDaLoja).eq('disponivel', true);
    
    if (!produtos || produtos.length === 0) { 
        document.getElementById('lista-produtos').innerHTML = '<p style="text-align:center;">Cardápio vazio.</p>'; 
        return; 
    }

    produtosCarregados = produtos; 
    renderizarProdutosNaTela(); 
}

function renderizarProdutosNaTela() {
    const listaHTML = document.getElementById('lista-produtos');
    listaHTML.innerHTML = '';

    let produtosParaMostrar = produtosCarregados;
    if (filtroCategoriaAtivo) {
        produtosParaMostrar = produtosCarregados.filter(p => p.categoria_id === filtroCategoriaAtivo);
    }

    if (produtosParaMostrar.length === 0) {
        listaHTML.innerHTML = '<p style="text-align:center; padding: 20px;">Nenhum produto nesta categoria.</p>';
        return;
    }

    produtosParaMostrar.forEach((produto) => {
        let indexReal = produtosCarregados.findIndex(p => p.id === produto.id);
        let precoFormatado = Number(produto.preco).toFixed(2).replace('.', ',');
        let foto = produto.imagem_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100&auto=format&fit=crop';
        
        listaHTML.innerHTML += `
            <div class="produto-card" id="card-${produto.id}" onclick="abrirDetalhe(${indexReal})">
                <img src="${foto}" class="produto-img">
                <div class="produto-info-lado">
                    <div class="produto-textos">
                        <h3>${produto.nome}</h3>
                        <p>${produto.descricao || ''}</p>
                        <strong>R$ ${precoFormatado}</strong>
                    </div>
                    <div class="controle-add">
                        <button class="btn-add" id="btn-${produto.id}" onclick="event.stopPropagation(); cliqueRapidoCard('${produto.id}', '${produto.nome}', ${produto.preco})">+</button>
                        <span class="qtd-no-card" id="qtd-${produto.id}"></span>
                    </div>
                </div>
            </div>
        `;
    });

    atualizarCarrinhoVisual(true);
}

window.filtrarPorCategoria = function(id, nome) {
    filtroCategoriaAtivo = id;
    document.getElementById('container-categorias').style.display = 'none';
    const caixaFiltro = document.getElementById('filtro-ativo');
    caixaFiltro.style.display = 'flex';
    document.getElementById('nome-filtro').innerText = `Mostrando: ${nome}`;
    renderizarProdutosNaTela();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.limparFiltro = function() {
    filtroCategoriaAtivo = null;
    document.getElementById('filtro-ativo').style.display = 'none';
    if (categoriasCarregadas.length > 0) {
        document.getElementById('container-categorias').style.display = 'block';
    }
    renderizarProdutosNaTela();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.abrirDetalhe = function(index) {
    const prod = produtosCarregados[index];
    precoBaseModalAtual = Number(prod.preco);
    
    document.getElementById('detalhe-foto').src = prod.imagem_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=100&auto=format&fit=crop';
    document.getElementById('detalhe-nome').innerText = prod.nome;
    document.getElementById('detalhe-desc').innerText = prod.descricao || '';
    
    let areaOpcoes = document.getElementById('area-ingredientes');
    areaOpcoes.innerHTML = '';

    let ingredientes = prod.ingredientes || [];
    if (ingredientes.length > 0) {
        let htmlIng = `<div class="titulo-opcoes">Retirar Ingredientes</div><ul class="lista-opcoes">`;
        ingredientes.forEach(ing => {
            htmlIng += `<li><label><div class="label-esquerda"><input type="checkbox" class="check-ingrediente" value="${ing}" checked> ${ing}</div></label></li>`;
        });
        htmlIng += `</ul>`;
        areaOpcoes.innerHTML += htmlIng;
    }

    let adicionais = prod.adicionais || [];
    if (adicionais.length > 0) {
        let htmlAdic = `<div class="titulo-opcoes">Turbine seu Pedido (Opcional)</div><ul class="lista-opcoes">`;
        adicionais.forEach(adic => {
            htmlAdic += `<li><label><div class="label-esquerda"><input type="checkbox" class="check-extra" value="${adic.nome}" data-preco="${adic.preco}" onchange="recalcularPrecoModal()"> + ${adic.nome}</div><span class="preco-extra">+ R$ ${Number(adic.preco).toFixed(2).replace('.', ',')}</span></label></li>`;
        });
        htmlAdic += `</ul>`;
        areaOpcoes.innerHTML += htmlAdic;
    }

    recalcularPrecoModal(); 
    document.getElementById('btn-add-detalhe-click').onclick = function() { processarModalEAdicionar(prod); };
    document.getElementById('modal-detalhe').style.display = 'flex';
}

window.fecharDetalhe = function() { document.getElementById('modal-detalhe').style.display = 'none'; }

window.recalcularPrecoModal = function() {
    let total = precoBaseModalAtual;
    document.querySelectorAll('.check-extra:checked').forEach(chk => { total += parseFloat(chk.dataset.preco); });
    document.getElementById('detalhe-preco').innerText = `R$ ${total.toFixed(2).replace('.', ',')}`;
}

function processarModalEAdicionar(prod) {
    let removidos = [];
    document.querySelectorAll('.check-ingrediente:not(:checked)').forEach(chk => removidos.push(chk.value));
    let extras = [];
    document.querySelectorAll('.check-extra:checked').forEach(chk => { extras.push({ nome: chk.value, preco: parseFloat(chk.dataset.preco) }); });

    adicionarAoCarrinho(prod.id, prod.nome, precoBaseModalAtual, removidos, extras);
    fecharDetalhe();
}

window.cliqueRapidoCard = function(id, nome, preco) { adicionarAoCarrinho(id, nome, preco, [], []); }

window.adicionarAoCarrinho = function(id, nome, precoBase, removidos, extras) {
    let idUnico = id + JSON.stringify(removidos) + JSON.stringify(extras);
    let itemExistente = carrinho.find(item => item.idUnico === idUnico);
    let precoExtras = extras.reduce((sum, ext) => sum + ext.preco, 0);
    let precoFinalItem = precoBase + precoExtras;

    if (itemExistente) { itemExistente.qtd += 1; } 
    else { carrinho.push({ idProduto: id, idUnico: idUnico, nome: nome, precoFinal: precoFinalItem, removidos: removidos, extras: extras, qtd: 1 }); }
    atualizarCarrinhoVisual();
}

window.removerDoCarrinho = function(index) {
    if (carrinho[index].qtd > 1) { carrinho[index].qtd -= 1; } 
    else { carrinho.splice(index, 1); }
    atualizarCarrinhoVisual();
    renderizarItensNoModal();
}

function atualizarCarrinhoVisual(apenasVisual = false) {
    let subtotal = carrinho.reduce((sum, item) => sum + (item.precoFinal * item.qtd), 0);
    let totalItens = carrinho.reduce((sum, item) => sum + item.qtd, 0);

    document.getElementById('qtd-itens').innerText = totalItens;
    document.getElementById('total-barra').innerText = subtotal.toFixed(2).replace('.', ',');
    document.getElementById('subtotal-modal').innerText = subtotal.toFixed(2).replace('.', ',');
    
    let taxa = Number(dadosLoja.taxa_entrega || 0);
    document.getElementById('total-final-modal').innerText = carrinho.length === 0 ? "0,00" : (subtotal + taxa).toFixed(2).replace('.', ',');

    document.querySelectorAll('.produto-card').forEach(card => {
        let produtoId = card.id.replace('card-', '');
        let txtQtd = document.getElementById(`qtd-${produtoId}`);
        let qtdDesteProduto = carrinho.filter(c => c.idProduto === produtoId).reduce((s, c) => s + c.qtd, 0);

        if (qtdDesteProduto > 0) {
            card.classList.add("card-selecionado");
            if(txtQtd) txtQtd.innerText = `${qtdDesteProduto} un.`;
        } else {
            card.classList.remove("card-selecionado");
            if(txtQtd) txtQtd.innerText = "";
        }
    });
}

function renderizarItensNoModal() {
    const listaModal = document.getElementById('itens-modal');
    listaModal.innerHTML = '';
    if (carrinho.length === 0) { listaModal.innerHTML = '<p style="text-align:center;">Vazio.</p>'; return; }
    
    carrinho.forEach((item, index) => {
        let subtotalItem = item.precoFinal * item.qtd;
        let textoDetalhes = '';
        if(item.removidos.length > 0) textoDetalhes += `Sem: ${item.removidos.join(', ')}<br>`;
        if(item.extras.length > 0) textoDetalhes += `Extra: ${item.extras.map(e => e.nome).join(', ')}`;

        listaModal.innerHTML += `
            <div class="item-carrinho">
                <div style="flex-grow: 1; padding-right: 15px;">
                    <strong>${item.qtd}x ${item.nome}</strong> (R$ ${(item.precoFinal).toFixed(2).replace('.', ',')}/un)
                    ${textoDetalhes ? `<span class="item-detalhes-texto">${textoDetalhes}</span>` : ''}
                </div>
                <div style="text-align: right;">
                    <strong style="display:block; margin-bottom: 5px;">R$ ${subtotalItem.toFixed(2).replace('.', ',')}</strong>
                    <button class="btn-remover-item" onclick="removerDoCarrinho(${index})">- Tirar 1</button>
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

window.finalizarPedido = function() {
    if (carrinho.length === 0) return;
    
    let mensagem = `*NOVO PEDIDO - ${dadosLoja.nome}* 🛵\n`;
    mensagem += `--------------------------------------\n\n`;
    
    let subtotal = 0;
    
    carrinho.forEach((item, index) => {
        let subtotalItem = item.precoFinal * item.qtd;
        mensagem += `*Item ${index + 1}: ${item.qtd}x ${item.nome}* (R$ ${subtotalItem.toFixed(2).replace('.', ',')})\n`;
        if(item.removidos.length > 0) { mensagem += `   🚫 *ATENÇÃO - RETIRAR:* ${item.removidos.join(', ')}\n`; }
        if(item.extras.length > 0) { mensagem += `   ➕ *ADICIONAIS:* ${item.extras.map(e => e.nome).join(', ')}\n`; }
        mensagem += `\n`; 
        subtotal += subtotalItem;
    });
    
    let taxa = Number(dadosLoja.taxa_entrega);
    let totalFinal = subtotal + taxa;
    
    mensagem += `--------------------------------------\n`;
    mensagem += `*Subtotal:* R$ ${subtotal.toFixed(2).replace('.', ',')}\n`;
    mensagem += `*Taxa de Entrega:* R$ ${taxa.toFixed(2).replace('.', ',')}\n`;
    mensagem += `*TOTAL A PAGAR: R$ ${totalFinal.toFixed(2).replace('.', ',')}*\n`;
    mensagem += `--------------------------------------\n\n`;
    
    if (dadosLoja.chave_pix) {
        mensagem += `💳 *Pagamento via PIX*\n`;
        mensagem += `Chave: *${dadosLoja.chave_pix}*\n\n`;
    }
    
    mensagem += `📍 _Por favor, envie seu endereço completo (Rua, Número, Bairro e Referência) aqui embaixo para confirmarmos o pedido!_`;
    
    window.open(`https://wa.me/${dadosLoja.whatsapp}?text=${encodeURIComponent(mensagem)}`, '_blank');
}

carregarLoja();