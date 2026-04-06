const supabaseUrl = 'https://eyslsyyctmokrbuwoprk.supabase.co';
const supabaseKey = 'sb_publishable_t9cAvHh2w-VWP3zxwSndmA_x0FPqsM1';
const db = window.supabase.createClient(supabaseUrl, supabaseKey);

async function carregarMural() {
    const { data: lojas, error } = await db
        .from('lojas')
        .select('*')
        .eq('ativa', true)
        .order('created_at', { ascending: false });

    const container = document.getElementById('container-lojas');
    container.innerHTML = '';

    if (error) {
        console.error("Erro ao buscar lojas:", error);
        container.innerHTML = '<p style="grid-column: span 2; text-align: center;">Erro ao carregar lojas.</p>';
        return;
    }

    if (!lojas || lojas.length === 0) {
        container.innerHTML = '<p style="grid-column: span 2; text-align: center;">Nenhuma loja ativa no momento.</p>';
        return;
    }

    lojas.forEach(loja => {
        // Usa a foto do banco, ou uma imagem padrão se a loja não tiver foto
        const foto = loja.logo_url || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400';
        
        container.innerHTML += `
            <div class="loja-card">
                <img src="${foto}" alt="${loja.nome}">
                <div class="loja-card-content">
                    <div>
                        <h3>${loja.nome}</h3>
                    </div>
                    <a href="loja.html?loja=${loja.slug}" class="btn-acessar">Ver Cardápio</a>
                </div>
            </div>
        `;
    });
}

carregarMural();