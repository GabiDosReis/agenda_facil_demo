// ARQUIVO DE LIGAÇÃO COM A API: todas as telas conversam com o servidor por aqui (funções api.get, api.post, api.patch e api.del).
/* Camada de acesso à API. Para ligar o back-end real:
   1) coloque USE_MOCK = false  2) ajuste API_URL.
   Contrato esperado (JSON): veja docs/api-contrato.md */
// A API fica na pasta /api ao lado do site (ex.: http://localhost/agendafacil/api). Muda sozinho conforme a pasta do projeto.
// Descobre a pasta do projeto a partir do endereço deste próprio script (assim funciona em qualquer pasta do XAMPP).
const RAIZ = document.currentScript ? new URL('../', document.currentScript.src).href : '/';
// Configurações do front-end.
const CONFIG = {
  // Endereço da API (a pasta /api ao lado do site).
  API_URL: RAIZ + 'api',   // se o back-end estiver em outro endereço, escreva aqui. Ex.: 'http://localhost:5000/api'
  // false = usa o servidor PHP de verdade; true = usa a API falsa do mock.js.
  USE_MOCK: true,         // true = usa a API falsa de js/mock.js (para testar só o front-end)
  // Passo da grade de horários (usado só pela API falsa).
  PASSO_MIN: 20,
};

// Função central: envia uma requisição à API e devolve a resposta já convertida (async = trabalha com espera pela resposta).
async function request(method, path, body) {
  // No modo de teste, usa a API falsa em vez do servidor.
  if (CONFIG.USE_MOCK) return mockRequest(method, path, body);
  // Cabeçalhos: avisa que o corpo é JSON.
  const headers = { 'Content-Type': 'application/json' };
  // Pega o token de login guardado no navegador (sessionStorage = vale só nesta aba).
  const token = sessionStorage.getItem('af_token');
  // Se há login, envia o token no cabeçalho Authorization.
  if (token) headers.Authorization = 'Bearer ' + token;
  // Vai guardar a resposta do servidor.
  let res;
  // Tenta chamar o servidor.
  try {
    // fetch faz a chamada HTTP; await espera a resposta. O corpo vai em JSON quando existir.
    res = await fetch(CONFIG.API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  // Se não conseguiu nem conectar (servidor desligado, sem internet)...
  } catch (e) {
    // ...lança um erro com mensagem amigável.
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
  }
  // Converte a resposta em objeto; se não for JSON, usa um objeto vazio.
  const data = await res.json().catch(() => ({}));
  // 401 = não autenticado: desfaz o login guardado.
  if (res.status === 401) { sair(false); }
  // Se o servidor respondeu com erro (400, 404, 409...), lança um erro com a mensagem dele.
  if (!res.ok) throw new Error(data.erro || 'Erro ' + res.status);
  // Devolve os dados da resposta.
  return data;
}
// Atalhos usados pelas telas: um para cada método HTTP.
const api = {
  // GET: buscar dados.
  get: (p) => request('GET', p),
  // POST: criar algo.
  post: (p, b) => request('POST', p, b),
  // PATCH: alterar parte de algo.
  patch: (p, b) => request('PATCH', p, b || {}),
  // DELETE: apagar.
  del: (p) => request('DELETE', p),
};
// Devolve os dados do usuário logado (guardados no navegador) ou null.
function usuarioLogado() { try { return JSON.parse(sessionStorage.getItem('af_user')); } catch (e) { return null; } }
// Encerra o login: avisa o servidor, apaga os dados do navegador e volta para a tela de login.
function sair(redirecionar = true) {
  // Token guardado.
  const token = sessionStorage.getItem('af_token');
  // Avisa o servidor para apagar a sessão (sem esperar a resposta).
  if (token && !CONFIG.USE_MOCK) fetch(CONFIG.API_URL + '/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, keepalive: true }).catch(() => {});
  // Apaga token e dados do usuário do navegador.
  sessionStorage.removeItem('af_user'); sessionStorage.removeItem('af_token');
  // Volta para a tela de login.
  if (redirecionar) location.href = base() + 'pages/login.html';
}
// Devolve o prefixo dos links: '../' dentro da pasta pages/, vazio na página inicial.
function base() { return location.pathname.includes('/pages/') ? '../' : ''; }
