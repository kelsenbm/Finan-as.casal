import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Suas credenciais reais do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCkfRok8Rq6djP9Kbk0vYGTwHdtPWpQGSw",
  authDomain: "financascasal-ef392.firebaseapp.com",
  projectId: "financascasal-ef392",
  storageBucket: "financascasal-ef392.firebasestorage.app",
  messagingSenderId: "677036240730",
  appId: "1:677036240730:web:9a8a4f4a57586c27ff0d63"
};

// Inicializa o Firebase e o Banco Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Seleção de elementos do DOM
const seletorMes = document.getElementById('seletor-mes');
const formTransacao = document.getElementById('form-transacao');
const containerTransacoes = document.getElementById('container-transacoes');
const resumoReceita = document.getElementById('resumo-receita');
const resumoMeta = document.getElementById('resumo-meta');
const barraFill = document.getElementById('barra-fill');
const progressoTexto = document.getElementById('progresso-texto');

let graficoInstance = null;
let unsubscribeEscuta = null;

// Função para formatar moeda em Real (R$)
const formatarMoeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Função principal que escuta as atualizações em Tempo Real do Firebase
function ligarSincronizacao(mesAno) {
    // Se já existia uma escuta ativa para outro mês, desliga ela antes de mudar
    if (unsubscribeEscuta) unsubscribeEscuta();

    const caminhoColecao = collection(db, "meses", mesAno, "transacoes");
    
    // O onSnapshot avisa o app na hora se você ou sua esposa adicionarem/deletarem algo
    unsubscribeEscuta = onSnapshot(caminhoColecao, (snapshot) => {
        let receitas = 0;
        let dividasFixas = 0;
        let transacoes = [];
        
        let categoriasGasto = { "Dívidas/Fixa": 0, "Habitação": 0, "Alimentação": 0, "Transporte": 0, "Lazer": 0, "Outros": 0 };

        containerTransacoes.innerHTML = "";

        snapshot.forEach((docSnap) => {
            const t = docSnap.data();
            t.id = docSnap.id; // guarda o ID para poder deletar depois
            transacoes.push(t);

            // Cálculos matemáticos
            if (t.tipo === "receita") {
                receitas += t.valor;
            } else {
                if (t.categoria === "Dívidas/Fixa") {
                    dividasFixas += t.valor;
                }
                // Soma para o gráfico
                if (categoriasGasto[t.categoria] !== undefined) {
                    categoriasGasto[t.categoria] += t.valor;
                }
            }

            // Renderiza na tela
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

        // Atualiza Cards de Resumo
        resumoReceita.innerText = formatarMoeda(receitas);
        resumoMeta.innerText = formatarMoeda(dividasFixas);

        // Barra de Progresso Inversa (Receitas cobrindo as Dívidas/Fixas)
        let percentual = 0;
        if (dividasFixas > 0) {
            percentual = Math.min((receitas / dividasFixas) * 100, 100); 
        } else if (receitas > 0 && dividasFixas === 0) {
            percentual = 100; // Se não tem dívida registrada e tem receita, tá 100% coberto
        }

        barraFill.style.width = `${percentual}%`;
        progressoTexto.innerText = `${percentual.toFixed(0)}%`;

        // Atualiza o Gráfico de Barras
        atualizarGrafico(categoriasGasto);
        
        // Adiciona evento de clique nos botões de deletar
        document.querySelectorAll('.btn-deletar').forEach(btn => {
            btn.onclick = async (e) => {
                const idDeletar = e.target.getAttribute('data-id');
                await deleteDoc(doc(db, "meses", mesAno, "transacoes", idDeletar));
            };
        });
    });
}

// Inicializar e atualizar o Gráfico Chart.js
function atualizarGrafico(dadosCategorias) {
    const ctx = document.getElementById('graficoCategorias').getContext('2d');
    const labels = Object.keys(dadosCategorias);
    const valores = Object.values(dadosCategorias);

    if (graficoInstance) {
        graficoInstance.data.datasets[0].data = valores;
        graficoInstance.update();
    } else {
        graficoInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: valores,
                    backgroundColor: '#FF3B30',
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

// Evento ao enviar o formulário (Inserir Gasto/Receita)
formTransacao.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const mesAtual = seletorMes.value;
    const novaTransacao = {
        descricao: document.getElementById('descricao').value,
        valor: parseFloat(document.getElementById('valor').value),
        tipo: document.getElementById('tipo').value,
        categoria: document.getElementById('categoria').value,
        dataCriacao: new Date().toISOString()
    };

    try {
        await addDoc(collection(db, "meses", mesAtual, "transacoes"), novaTransacao);
        formTransacao.reset(); // Limpa os campos do formulário
    } catch (error) {
        alert("Erro ao salvar: " + error.message);
    }
});

// Evento ao mudar o mês no Seletor
seletorMes.addEventListener('change', (e) => {
    ligarSincronizacao(e.target.value);
});

// Inicialização padrão no mês selecionado ao abrir a tela
ligarSincronizacao(seletorMes.value);
