import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// 🚨 DEFINAM OS LIMITES DE VOCÊS AQUI (Abaixo estão valores de exemplo, mude como quiserem!)
const LIMITES_DESPESAS = {
    "Dívidas": 2000,
    "Mercado": 800,
    "Despesas eventuais": 300,
    "Compras": 400,
    "Saúde": 500,
    "Presentes": 200,
    "Beleza": 150,
    "Desenvolvimento": 300,
    "Lazer": 300, // Seu exemplo de R$ 300 reais
    "Assinaturas": 100,
    "Transporte": 300,
    "Peugeot 208": 600,
    "Alimentação": 500,
    "Habitação": 1500,
    "Contas": 600
};

// Listas oficiais passadas por você
const CATEGORIAS_RECEITA = ["Aluguel", "Motorista de app", "Seguro", "Vendas", "Marketing"];
const CATEGORIAS_DESPESA = Object.keys(LIMITES_DESPESAS);

const seletorMes = document.getElementById('seletor-mes');
const formTransacao = document.getElementById('form-transacao');
const containerTransacoes = document.getElementById('container-transacoes');
const resumoReceita = document.getElementById('resumo-receita');
const resumoMeta = document.getElementById('resumo-meta');
const barraFill = document.getElementById('barra-fill');
const progressoTexto = document.getElementById('progresso-texto');
const selectTipo = document.getElementById('tipo');
const selectCategoria = document.getElementById('categoria');

let graficoInstance = null;
let unsubscribeEscuta = null;

const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Altera as opções do select de categoria dependendo se escolheu Receita ou Despesa
function atualizarSelectCategorias() {
    const tipo = selectTipo.value;
    selectCategoria.innerHTML = "";
    
    const lista = tipo === 'receita' ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA;
    lista.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.innerText = cat;
        selectCategoria.appendChild(opt);
    });
}
selectTipo.addEventListener('change', atualizarSelectCategorias);
atualizarSelectCategorias(); // roda a primeira vez ao abrir o app

function ligarSincronizacao(mesAno) {
    if (unsubscribeEscuta) unsubscribeEscuta();

    const caminhoColecao = collection(db, "meses", mesAno, "transacoes");
    
    unsubscribeEscuta = onSnapshot(caminhoColecao, (snapshot) => {
        let receitas = 0;
        let despesasTotais = 0;
        
        let categoriasGasto = {};
        CATEGORIAS_DESPESA.forEach(cat => categoriasGasto[cat] = 0);

        containerTransacoes.innerHTML = "";

        snapshot.forEach((docSnap) => {
            const t = docSnap.data();
            t.id = docSnap.id;

            if (t.tipo === "receita") {
                receitas += t.valor;
            } else {
                despesasTotais += t.valor; // Agora TODAS as despesas entram na soma de Gastos/Dívidas
                if (categoriasGasto[t.categoria] !== undefined) {
                    categoriasGasto[t.categoria] += t.valor;
                }
            }

            const item = document.createElement('div');
            item.className = 'item-transacao';
            const classeCor = t.tipo === 'receita' ? 'receita-valor' : 'despesa-valor';
            const sinal = t.tipo === 'receita' ? '+' : '-';
            
            item.innerHTML = `
                <div>
                    <strong>${t.descricao}</strong> <br>
                    <small style="color: var(--cor-mutada); font-size:0.75rem">${t.categoria}</small>
                </div>
                <div>
                    <span class="${classeCor}">${sinal} ${formatarMoeda(t.valor)}</span>
                    <button class="btn-deletar" data-id="${t.id}">✕</button>
                </div>
            `;
            containerTransacoes.appendChild(item);
        });

        resumoReceita.innerText = formatarMoeda(receitas);
        resumoMeta.innerText = formatarMoeda(despesasTotais);

        // Progresso Inverso corrigido
        let percentual = 0;
        if (despesasTotais > 0) {
            percentual = Math.min((receitas / despesasTotais) * 100, 100); 
        } else if (receitas > 0 && despesasTotais === 0) {
            percentual = 100;
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
    
    // Filtra para mostrar no gráfico apenas categorias que já possuem algum gasto lançado (evita poluição visual)
    const labels = Object.keys(dadosCategorias).filter(cat => dadosCategorias[cat] > 0);
    const valores = labels.map(cat => dadosCategorias[cat]);
    
    // 🚨 REGRA DO ALERTA VISUAL: Define a cor de cada barra individualmente
    const coresBarras = labels.map(cat => {
        const limite = LIMITES_DESPESAS[cat] || 999999;
        return dadosCategorias[cat] > limite ? '#FF9500' : '#FF3B30'; // Laranja se estourar, Vermelho se estiver ok
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
        dataCriacao: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "meses", mesAtual, "transacoes"), novaTransacao);
        formTransacao.reset();
        atualizarSelectCategorias(); // Restaura as categorias corretas após o reset
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
});

seletorMes.addEventListener('change', (e) => ligarSincronizacao(e.target.value));
ligarSincronizacao(seletorMes.value);
