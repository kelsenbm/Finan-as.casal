import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCkfRok8Rq6djP9Kbk0vYGTwHdtPWpQGSw",
  authDomain: "financascasal-ef392.firebaseapp.com",
  projectId: "financascasal-ef392",
  storageBucket: "financascasal-ef392.firebasestorage.app",
  messagingSenderId: "677036240730",
  appId: "1:677036240730:web:9a8a4f4a57586c27ff0d63"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CATEGORIAS_RECEITA = ["Aluguel", "Motorista de app", "Seguro", "Vendas", "Marketing", "Salário", "Outros"];
const CATEGORIAS_DESPESA = [
    "Dívidas", "Mercado", "Despesas eventuais", "Compras", "Saúde", 
    "Presentes", "Beleza", "Desenvolvimento", "Lazer", "Assinaturas", 
    "Transporte", "Peugeot 208", "Alimentação", "Habitação", "Contas"
];

let LIMITES_ATUAIS = {}; 
CATEGORIAS_DESPESA.forEach(cat => LIMITES_ATUAIS[cat] = 0);

// Elementos do DOM
const seletorMes = document.getElementById('seletor-mes');
const formTransacao = document.getElementById('form-transacao');
const containerTransacoes = document.getElementById('container-transacoes');
const resumoReceita = document.getElementById('resumo-receita');
const resumoMeta = document.getElementById('resumo-meta');
const gastoEleEl = document.getElementById('gasto-ele');
const gastoElaEl = document.getElementById('gasto-ela');
const barraFill = document.getElementById('barra-fill');
const progressoTexto = document.getElementById('progresso-texto');
const selectTipo = document.getElementById('tipo');
const selectCategoria = document.getElementById('categoria');
const selectResponsavel = document.getElementById('responsavel');
const selectMetodo = document.getElementById('metodo-pagamento');

// Elementos do painel de limites
const btnToggleLimites = document.getElementById('btn-toggle-limites');
const painelLimites = document.getElementById('painel-limites');
const containerInputsLimites = document.getElementById('container-inputs-limites');
const btnSalvarLimites = document.getElementById('btn-salvar-limites');

let graficoInstance = null;
let unsubscribeEscuta = null;

const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Altera as opções do select de categoria
function atualizarSelectCategorias() {
    const tipo = selectTipo.value;
    selectCategoria.innerHTML = "";
    const lista = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
    lista.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat; opt.innerText = cat;
        selectCategoria.appendChild(opt);
    });
}
selectTipo.addEventListener('change', atualizarSelectCategorias);
atualizarSelectCategorias();

// Alternar exibição do painel de limites
btnToggleLimites.onclick = () => {
    if(painelLimites.style.display === 'flex') {
        painelLimites.style.display = 'none';
    } else {
        renderizarInputsLimites();
        painelLimites.style.display = 'flex';
    }
};

function renderizarInputsLimites() {
    containerInputsLimites.innerHTML = "";
    CATEGORIAS_DESPESA.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'linha-limite';
        div.innerHTML = `
            <span>${cat}:</span>
            <input type="number" step="1" data-cat="${cat}" value="${LIMITES_ATUAIS[cat] || 0}">
        `;
        containerInputsLimites.appendChild(div);
    });
}

btnSalvarLimites.onclick = async () => {
    const mesAtual = seletorMes.value;
    const novosLimites = {};
    
    containerInputsLimites.querySelectorAll('input').forEach(input => {
        novosLimites[input.getAttribute('data-cat')] = parseFloat(input.value) || 0;
    });

    await setDoc(doc(db, "meses", mesAtual, "configuracoes", "limites"), novosLimites);
    LIMITES_ATUAIS = novosLimites;
    painelLimites.style.display = 'none';
    ligarSincronizacao(mesAtual);
};

async function ligarSincronizacao(mesAno) {
    const limiteDoc = await getDoc(doc(db, "meses", mesAno, "configuracoes", "limites"));
    if(limiteDoc.exists()) {
        LIMITES_ATUAIS = limiteDoc.data();
    } else {
        CATEGORIAS_DESPESA.forEach(cat => LIMITES_ATUAIS[cat] = 0);
    }

    if (unsubscribeEscuta) unsubscribeEscuta();
    const caminhoColecao = collection(db, "meses", mesAno, "transacoes");
    
    unsubscribeEscuta = onSnapshot(caminhoColecao, (snapshot) => {
        let receitas = 0;
        let despesasTotais = 0;
        let gastosEle = 0;
        let gastosEla = 0;
        let categoriasGasto = {};
        CATEGORIAS_DESPESA.forEach(cat => categoriasGasto[cat] = 0);

        containerTransacoes.innerHTML = "";

        snapshot.forEach((docSnap) => {
            const t = docSnap.data();
            t.id = docSnap.id;

            if (t.tipo === "receita") {
                receitas += t.valor;
            } else {
                despesasTotais += t.valor;
                
                // Mapeia gastos individuais
                if (t.responsavel === "ele") gastosEle += t.valor;
                if (t.responsavel === "ela") gastosEla += t.valor;

                if (categoriasGasto[t.categoria] !== undefined) {
                    categoriasGasto[t.categoria] += t.valor;
                }
            }

            // Mapeamento visual da badge do responsável
            let badgeHtml = '';
            if (t.responsavel === 'ele') badgeHtml = '<span class="badge-pessoa badge-ele">Esposo</span>';
            else if (t.responsavel === 'ela') badgeHtml = '<span class="badge-pessoa badge-ela">Esposa</span>';
            else badgeHtml = '<span class="badge-pessoa badge-casal">Casa</span>';

            const metodoTxt = t.metodoPagamento === 'cartao' ? ' 💳' : ' 💸';

            const item = document.createElement('div');
            item.className = 'item-transacao';
            const classeCor = t.tipo === 'receita' ? 'receita-valor' : 'despesa-valor';
            const sinal = t.tipo === 'receita' ? '+' : '-';
            
            item.innerHTML = `
                <div>
                    <strong>${t.descricao}</strong> ${badgeHtml} <br>
                    <small style="color: var(--cor-mutada); font-size:0.75rem">${t.categoria}${metodoTxt}</small>
                </div>
                <div>
                    <span class="${classeCor}">${sinal} ${formatarMoeda(t.valor)}</span>
                    <button class="btn-deletar" data-id="${t.id}">✕</button>
                </div>
            `;
            containerTransacoes.appendChild(item);
        });

        // Atualização dos cards do Dashboard
        resumoReceita.innerText = formatarMoeda(receitas);
        resumoMeta.innerText = formatarMoeda(despesasTotais);
        if (gastoEleEl) gastoEleEl.innerText = formatarMoeda(gastosEle);
        if (gastoElaEl) gastoElaEl.innerText = formatarMoeda(gastosEla);

        // Progresso do orçamento com base na receita ou teto total
        let tetoTotal = Object.values(LIMITES_ATUAIS).reduce((acc, curr) => acc + curr, 0);
        let baseCalculo = tetoTotal > 0 ? tetoTotal : receitas;
        
        let percentual = 0;
        if (baseCalculo > 0) {
            percentual = Math.min((despesasTotais / baseCalculo) * 100, 100); 
        }

        barraFill.style.width = `${percentual}%`;
        progressoTexto.innerText = `${percentual.toFixed(0)}%`;

        atualizarGrafico(categoriasGasto);
        
        document.querySelectorAll('.btn-deletar').forEach(btn => {
            btn.onclick = async (e) => {
                await deleteDoc(doc(db, "meses", mesAno, "transacoes", e.target.getAttribute('data-id')));
            };
        });
    });
}

function atualizarGrafico(dadosCategorias) {
    const ctx = document.getElementById('graficoCategorias').getContext('2d');
    const labels = Object.keys(dadosCategorias).filter(cat => dadosCategorias[cat] > 0);
    const valores = labels.map(cat => dadosCategorias[cat]);
    
    const coresBarras = labels.map(cat => {
        const limiteDefinido = LIMITES_ATUAIS[cat] || 0;
        if (limiteDefinido > 0 && dadosCategorias[cat] > limiteDefinido) {
            return '#FF3B30'; // Vermelho (Estourou o limite)
        }
        return '#FF9500'; // Laranja Padrão
    });

    if (graficoInstance) {
        graficoInstance.data.labels = labels;
        graficoInstance.data.datasets[0].data = valores;
        graficoInstance.data.datasets[0].backgroundColor = coresBarras;
        graficoInstance.update();
    } else {
        graficoInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: valores,
                    backgroundColor: coresBarras,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8E8E93' } },
                    x: { grid: { display: false }, ticks: { color: '#8E8E93' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

formTransacao.addEventListener('submit', async (e) => {
    e.preventDefault();
    const mesAtual = seletorMes.value;
    
    const novaTransacao = {
        descricao: document.getElementById('descricao').value,
        valor: parseFloat(document.getElementById('valor').value),
        tipo: selectTipo.value,
        categoria: selectCategoria.value,
        responsavel: selectResponsavel.value,
        metodoPagamento: selectMetodo.value,
        dataCriacao: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "meses", mesAtual, "transacoes"), novaTransacao);
        
        // Limpa campos mantendo a estrutura padrão
        document.getElementById('descricao').value = '';
        document.getElementById('valor').value = '';
        selectResponsavel.selectedIndex = 0;
        
        atualizarSelectCategorias();
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
});

seletorMes.addEventListener('change', (e) => ligarSincronizacao(e.target.value));
ligarSincronizacao(seletorMes.value);
