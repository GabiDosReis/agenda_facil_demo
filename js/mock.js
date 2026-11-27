// API FALSA para desenvolver o front-end sem o servidor PHP (USE_MOCK = true em api.js). Guarda tudo no localStorage do navegador.
/* API FALSA para desenvolver o front-end sem back-end. Apague quando o servidor real estiver pronto.
   Atenção: guarda tudo no localStorage e senha em texto puro. Só para testes! */
// Nome sob o qual o 'banco de dados' falso fica guardado no navegador.
const DB_KEY = 'af_mock_db';
// Carrega o banco falso; se ainda não existir, cria um com dados de exemplo.
function dbLoad() {
  // Tenta ler o banco já guardado.
  let d = JSON.parse(localStorage.getItem(DB_KEY) || 'null');
  // Se existe, devolve.
  if (d) return d;
  // Auxiliar: cria expedientes de segunda a sexta para os profissionais informados.
  const dias = (ids, ini, fim) => ids.flatMap(p => [1, 2, 3, 4, 5].map(dia => ({ profissional_id: p, dia_semana: dia, hora_inicio: ini, hora_fim: fim })));
  // Banco inicial de exemplo: especialidades, tipos, profissionais e um administrador.
  d = {
    seq: 100,
    especialidades: [{ id: 1, nome: 'Clínica geral' }, { id: 2, nome: 'Dermatologia' }, { id: 3, nome: 'Cardiologia' }],
    tipos: [{ id: 1, nome: 'Consulta normal', duracao_min: 40, eh_retorno: 0 }, { id: 2, nome: 'Retorno', duracao_min: 20, eh_retorno: 1 }],
    profissionais: [
      { id: 1, nome: 'Dr. Carlos', especialidade_id: 1, registro_profissional: 'CRM-XX 00000', ativo: 1, tipo_ids: [1, 2] },
      { id: 2, nome: 'Dra. Ana', especialidade_id: 1, registro_profissional: 'CRM-XX 11111', ativo: 1, tipo_ids: [1, 2] },
      { id: 3, nome: 'Dr. Paulo', especialidade_id: 2, registro_profissional: 'CRM-XX 22222', ativo: 1, tipo_ids: [1, 2] }],
    expedientes: [], agendamentos: [],
    usuarios: [{ id: 1, nome: 'Secretaria', email: 'admin@clinica.com', senha: 'admin123', perfil: 'admin_clinica' }],
  };
  // Define os horários de trabalho dos três profissionais.
  d.expedientes = [...dias([1], '08:00', '12:00'), ...dias([1], '14:00', '18:00'), ...dias([2], '09:00', '13:00'), ...dias([3], '09:00', '12:00')]
    .map((e, i) => ({ id: i + 1, ...e }));
  // Devolve o banco criado.
  return d;
}
// Grava o banco falso no navegador.
const dbSave = (d) => localStorage.setItem(DB_KEY, JSON.stringify(d));
// Converte 'HH:MM' em minutos desde a meia-noite.
const min = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
// Converte minutos em 'HH:MM'.
const hhmm = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
// Cria um erro com mensagem e código HTTP.
const erro = (msg, status = 400) => { const e = new Error(msg); e.status = status; return e; };

// Mesma regra do servidor: gera os horários livres de um profissional num dia.
function horariosLivres(d, profId, tipoId, data) {
  // Busca o tipo de consulta (para saber a duração).
  const tipo = d.tipos.find(t => t.id === tipoId);
  // Tipo inexistente: sem horários.
  if (!tipo) return [];
  // Dia da semana da data (0 = domingo).
  const dow = new Date(data + 'T00:00').getDay();
  // Intervalos das consultas já agendadas desse profissional nesse dia.
  const ocupados = d.agendamentos.filter(a => a.profissional_id === profId && a.status === 'agendado' && a.inicio.startsWith(data))
    .map(a => [min(a.inicio.slice(11)), min(a.fim.slice(11))]);
  // Bloqueios (férias, feriados...) do profissional ou da clínica inteira que tocam esse dia.
  const bloqs = (d.bloqueios || []).filter(b => (b.profissional_id === null || b.profissional_id === profId) && b.inicio < data + 'T23:59' && b.fim > data + 'T00:00');
  // Momento atual e lista dos horários livres.
  const agora = new Date(), livres = [];
  // Para cada expediente do dia...
  d.expedientes.filter(e => e.profissional_id === profId && e.dia_semana === dow).forEach(e => {
    // ...testa horários de passo em passo enquanto a consulta couber.
    for (let t = min(e.hora_inicio); t + tipo.duracao_min <= min(e.hora_fim); t += CONFIG.PASSO_MIN) {
      // Fim da consulta se começar em t.
      const fim = t + tipo.duracao_min;
      // Pula horários que já passaram.
      if (new Date(data + 'T' + hhmm(t)) < agora) continue;                  // RN06
      // Pula horários dentro de um bloqueio.
      if (bloqs.some(b => b.inicio < data + 'T' + hhmm(fim) && b.fim > data + 'T' + hhmm(t))) continue;
      // Pula horários que se sobrepõem a outra consulta.
      if (ocupados.some(([i, f]) => t < f && i < fim)) continue;             // RN09
      // Horário livre: guarda.
      livres.push(hhmm(t));
    }
  });
  // Remove repetidos e ordena.
  return [...new Set(livres)].sort();
}

// Faz o papel do servidor: recebe método, caminho e corpo e devolve a resposta.
async function mockRequest(method, fullPath, body) {
  // Carrega o banco falso.
  const d = dbLoad();
  // Separa o caminho dos parâmetros da URL.
  const [path, qs] = fullPath.split('?');
  // Converte os parâmetros em objeto.
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  // Descobre quem está logado pelo token.
  const user = d.usuarios.find(u => 'mock-' + u.id === sessionStorage.getItem('af_token'));
  // Exige login (e perfil), como no servidor.
  const exigir = (perfil) => { if (!user) throw erro('Faça login para continuar.', 401); if (perfil && user.perfil !== perfil) throw erro('Sem permissão.', 403); };
  // Auxiliares para buscar nomes.
  const nomeProf = (id) => (d.profissionais.find(p => p.id === id) || {}).nome;
  const nomeTipo = (id) => (d.tipos.find(t => t.id === id) || {}).nome;
  // Guarda trechos capturados nos caminhos (ex.: o número do id).
  let m;

  // Login: confere e-mail e senha.
  if (method === 'POST' && path === '/auth/login') {
    // Limite de tentativas (igual ao servidor): 5 erros no mesmo e-mail bloqueiam por 15 minutos.
    d.tent = d.tent || {}; const t = d.tent[body.email] || { falhas: 0, ate: 0 };
    if (t.ate > Date.now()) throw erro('Muitas tentativas de login. Tente novamente em ' + Math.ceil((t.ate - Date.now()) / 60000) + ' minutos.', 429);
    // Procura o usuário.
    const u = d.usuarios.find(x => x.email === body.email && x.senha === body.senha);
    // Não achou: conta o erro e responde 401 (ou 429 se acabou de bloquear).
    if (!u) {
      t.falhas++; if (t.falhas >= 5) t.ate = Date.now() + 15 * 60000; d.tent[body.email] = t; dbSave(d);
      if (t.falhas >= 5) throw erro('Você errou a senha 5 vezes. Login bloqueado por 15 minutos.', 429);
      throw erro('E-mail ou senha incorretos. ' + (5 - t.falhas === 1 ? 'Resta 1 tentativa' : 'Restam ' + (5 - t.falhas) + ' tentativas') + ' antes do bloqueio.', 401);
    }
    // Senha correta: zera os erros.
    delete d.tent[body.email]; dbSave(d);
    // Aba escolhida no login: a conta precisa ser do tipo escolhido.
    if (body.tipo === 'paciente' && u.perfil !== 'paciente') throw erro('Esta conta é de uma clínica. Use a aba "Uso clínico".', 403);
    if (body.tipo === 'clinica' && u.perfil !== 'admin_clinica') throw erro('Esta conta é de paciente. Use a aba "Uso pessoal".', 403);
    // Devolve o token e os dados do usuário.
    return { token: 'mock-' + u.id, usuario: { id: u.id, nome: u.nome, perfil: u.perfil, trocar_senha: ['admin123', 'paciente123', 'clinica123'].includes(body.senha) } };
  }
  // Cadastro de paciente.
  if (method === 'POST' && path === '/auth/cadastro') {
    if (!body.aceite_lgpd) throw erro('É necessário aceitar a política de privacidade.');
    if (d.usuarios.some(x => x.email === body.email)) throw erro('Já existe uma conta com este e-mail.', 409);
    d.usuarios.push({ id: ++d.seq, nome: body.nome, email: body.email, senha: body.senha, cpf: body.cpf, telefone: body.telefone, perfil: 'paciente' });
    dbSave(d); return { ok: true };
  }
  // Cadastro de clínica (cria o administrador; a clínica de exemplo é a única que os pacientes enxergam).
  if (method === 'POST' && path === '/auth/cadastro-clinica') {
    if (!body.aceite_lgpd) throw erro('É necessário aceitar a política de privacidade.');
    if (d.usuarios.some(x => x.email === body.email)) throw erro('Já existe uma conta com este e-mail.', 409);
    d.usuarios.push({ id: ++d.seq, nome: body.nome, email: body.email, senha: body.senha, perfil: 'admin_clinica', clinica: body.clinica });
    dbSave(d); return { ok: true };
  }
  // Clínicas disponíveis para o paciente (na API falsa são duas, só para testar o seletor; os dados são os mesmos).
  if (method === 'GET' && path === '/clinicas') { exigir(); return [{ id: 1, nome: 'Clínica Exemplo', endereco: 'Rua das Flores, 100' }, { id: 2, nome: 'Clínica Vida Saudável', endereco: 'Av. Brasil, 500' }]; }
  // Esqueci minha senha: resposta sempre igual.
  if (method === 'POST' && path === '/auth/esqueci-senha') return { ok: true, mensagem: 'Se este e-mail tiver cadastro, enviamos um link para redefinir a senha.' };
  // Redefinir senha com o código do link (na API falsa vale qualquer código de 64 caracteres).
  if (method === 'POST' && path === '/auth/redefinir-senha') {
    if (!/^[a-f0-9]{64}$/.test(body.token || '')) throw erro('Link inválido ou vencido. Peça um novo em "Esqueci minha senha".', 400);
    if ((body.senha || '').length < 8) throw erro('A senha precisa ter pelo menos 8 caracteres.');
    return { ok: true };
  }
  // Alterar a própria senha.
  if (method === 'POST' && path === '/auth/alterar-senha') {
    exigir(); const me = d.usuarios.find(x => x.id === user.id);
    if (!me || me.senha !== body.senha_atual) throw erro('A senha atual está incorreta.', 403);
    if ((body.nova_senha || '').length < 8) throw erro('A senha precisa ter pelo menos 8 caracteres.');
    me.senha = body.nova_senha; dbSave(d); return { ok: true, token: 'mock-' + me.id };
  }
  // Lista de especialidades.
  if (method === 'GET' && path === '/especialidades') return d.especialidades;
  // Lista de tipos de consulta.
  if (method === 'GET' && path === '/tipos-consulta') return d.tipos;
  // Profissionais ativos e com expediente, com filtros.
  if (method === 'GET' && path === '/profissionais') {
    exigir();
    return d.profissionais.filter(p => p.ativo && d.expedientes.some(e => e.profissional_id === p.id)       // RN20
      && (!q.especialidade_id || p.especialidade_id === +q.especialidade_id)
      && (!q.tipo_consulta_id || p.tipo_ids.includes(+q.tipo_consulta_id)))
      .map(p => ({ ...p, especialidade: d.especialidades.find(e => e.id === p.especialidade_id).nome }));
  }
  // Horários livres.
  if (method === 'GET' && path === '/horarios') { exigir(); return horariosLivres(d, +q.profissional_id, +q.tipo_consulta_id, q.data); }
  // Criar agendamento (confere de novo se o horário está livre).
  if (method === 'POST' && path === '/agendamentos') {
    exigir('paciente');
    const tipo = d.tipos.find(t => t.id === body.tipo_consulta_id);
    const [data, hora] = body.inicio.split('T');
    if (!horariosLivres(d, body.profissional_id, body.tipo_consulta_id, data).includes(hora))   // RN21
      throw erro('Este horário acabou de ser ocupado. Escolha outro.', 409);
    const fim = data + 'T' + hhmm(min(hora) + tipo.duracao_min);
    d.agendamentos.push({ id: ++d.seq, paciente_id: user.id, profissional_id: body.profissional_id, tipo_consulta_id: tipo.id, inicio: body.inicio, fim, status: 'agendado', convenio: body.convenio || 'Particular' });
    dbSave(d); return { ok: true };
  }
  // Consultas do paciente.
  if (method === 'GET' && path === '/agendamentos/meus') {
    exigir('paciente');
    return d.agendamentos.filter(a => a.paciente_id === user.id).sort((a, b) => b.inicio.localeCompare(a.inicio))
      .map(a => ({ ...a, confirmado: !!a.confirmado_em, clinica_id: 1, clinica: 'Clínica Exemplo', profissional: nomeProf(a.profissional_id), tipo: nomeTipo(a.tipo_consulta_id) }));
  }
  // Cancelar consulta.
  if ((m = path.match(/^\/agendamentos\/(\d+)\/cancelar$/)) && method === 'PATCH') {
    exigir(); const a = d.agendamentos.find(x => x.id === +m[1]);
    if (!a) throw erro('Agendamento não encontrado.', 404);
    a.status = 'cancelado'; dbSave(d); return { ok: true };                                      // RN14
  }
  // Agenda do dia da clínica.
  if (method === 'GET' && path === '/clinica/agenda') {
    exigir('admin_clinica');
    return d.agendamentos.filter(a => a.inicio.startsWith(q.data)).sort((a, b) => a.inicio.localeCompare(b.inicio))
      .map(a => ({ ...a, profissional: nomeProf(a.profissional_id), tipo: nomeTipo(a.tipo_consulta_id), paciente: (d.usuarios.find(u => u.id === a.paciente_id) || {}).nome, telefone: (d.usuarios.find(u => u.id === a.paciente_id) || {}).telefone || '', confirmado: !!a.confirmado_em, lembrete_enviado: !!a.lembrete_em }));
  }
  // Listar e criar profissionais.
  if (path === '/clinica/profissionais') {
    exigir('admin_clinica');
    if (method === 'GET') return d.profissionais.map(p => ({ ...p, especialidade: d.especialidades.find(e => e.id === p.especialidade_id).nome }));
    if (method === 'POST') { d.profissionais.push({ id: ++d.seq, ativo: 1, ...body }); dbSave(d); return { ok: true }; }
  }
  // Ativar ou desativar profissional.
  if ((m = path.match(/^\/clinica\/profissionais\/(\d+)$/)) && method === 'PATCH') {
    exigir('admin_clinica'); Object.assign(d.profissionais.find(p => p.id === +m[1]), body); dbSave(d); return { ok: true };
  }
  // Listar e criar tipos de consulta.
  if (path === '/clinica/tipos-consulta') {
    exigir('admin_clinica');
    if (method === 'GET') return d.tipos;
    if (method === 'POST') { d.tipos.push({ id: ++d.seq, ...body }); dbSave(d); return { ok: true }; }
  }
  // Listar e criar expedientes.
  if (path === '/clinica/expedientes') {
    exigir('admin_clinica');
    if (method === 'GET') return d.expedientes.filter(e => e.profissional_id === +q.profissional_id).sort((a, b) => a.dia_semana - b.dia_semana || a.hora_inicio.localeCompare(b.hora_inicio));
    if (method === 'POST') { d.expedientes.push({ id: ++d.seq, ...body }); dbSave(d); return { ok: true }; }
  }
  // Remover expediente.
  if ((m = path.match(/^\/clinica\/expedientes\/(\d+)$/)) && method === 'DELETE') {
    exigir('admin_clinica'); d.expedientes = d.expedientes.filter(e => e.id !== +m[1]); dbSave(d); return { ok: true };
  }
  // ===== ROTAS EXTRAS DA DEMONSTRAÇÃO (lista de espera, bloqueios, relatório, lembretes, presença e reagendar) =====
  // Nome do paciente e telefone (auxiliar).
  const pac = (id) => d.usuarios.find(u => u.id === id) || {};
  // Entrar na lista de espera.
  if (method === 'POST' && path === '/lista-espera') {
    exigir('paciente'); d.espera = d.espera || [];
    d.espera.push({ id: ++d.seq, paciente_id: user.id, profissional_id: body.profissional_id, tipo_consulta_id: body.tipo_consulta_id, data: body.data, status: 'aguardando' });
    dbSave(d); return { ok: true };
  }
  // Lista de espera do paciente.
  if (method === 'GET' && path === '/lista-espera') {
    exigir('paciente');
    return (d.espera || []).filter(e => e.paciente_id === user.id).map(e => ({ ...e, clinica_id: 1, profissional: nomeProf(e.profissional_id), tipo: nomeTipo(e.tipo_consulta_id) }));
  }
  // Sair da lista de espera.
  if ((m = path.match(/^\/lista-espera\/(\d+)$/)) && method === 'DELETE') { exigir('paciente'); d.espera = (d.espera || []).filter(e => e.id !== +m[1]); dbSave(d); return { ok: true }; }
  // Lista de espera vista pela clínica.
  if (method === 'GET' && path === '/clinica/lista-espera') {
    exigir('admin_clinica');
    return (d.espera || []).map(e => ({ ...e, paciente: pac(e.paciente_id).nome, telefone: pac(e.paciente_id).telefone || '', profissional: nomeProf(e.profissional_id), tipo: nomeTipo(e.tipo_consulta_id) }));
  }
  // Bloqueios: listar, criar e remover.
  if (method === 'GET' && path === '/clinica/bloqueios') {
    exigir('admin_clinica');
    return (d.bloqueios || []).map(b => ({ ...b, profissional: b.profissional_id ? nomeProf(b.profissional_id) : 'Toda a clínica' }));
  }
  if (method === 'POST' && path === '/clinica/bloqueios') {
    exigir('admin_clinica'); d.bloqueios = d.bloqueios || [];
    const fimDia = new Date((body.data_fim || body.data_inicio) + 'T12:00'); fimDia.setDate(fimDia.getDate() + 1);
    const inicio = body.data_inicio + 'T' + (body.hora_inicio || '00:00');
    const fim = body.hora_fim ? (body.data_fim || body.data_inicio) + 'T' + body.hora_fim : fimDia.toISOString().slice(0, 10) + 'T00:00';
    if (fim <= inicio) throw erro('O fim do bloqueio deve ser depois do início.', 400);
    d.bloqueios.push({ id: ++d.seq, profissional_id: body.profissional_id || null, inicio, fim, motivo: body.motivo || '' });
    const conflitos = d.agendamentos.filter(a => a.status === 'agendado' && (!body.profissional_id || a.profissional_id === body.profissional_id) && a.inicio < fim && a.fim > inicio).length;
    dbSave(d); return { ok: true, conflitos };
  }
  if ((m = path.match(/^\/clinica\/bloqueios\/(\d+)$/)) && method === 'DELETE') { exigir('admin_clinica'); d.bloqueios = (d.bloqueios || []).filter(b => b.id !== +m[1]); dbSave(d); return { ok: true }; }
  // Presença: compareceu ou faltou.
  if ((m = path.match(/^\/clinica\/agendamentos\/(\d+)\/status$/)) && method === 'PATCH') {
    exigir('admin_clinica'); const a = d.agendamentos.find(x => x.id === +m[1]); if (!a) throw erro('Agendamento não encontrado.', 404);
    a.status = body.status; dbSave(d); return { ok: true };
  }
  // Reagendar (paciente ou clínica): confere o horário e move a consulta.
  if ((m = path.match(/^\/agendamentos\/(\d+)\/reagendar$/)) && method === 'PATCH') {
    exigir(); const a = d.agendamentos.find(x => x.id === +m[1]); if (!a) throw erro('Agendamento não encontrado.', 404);
    const tipo = d.tipos.find(t => t.id === a.tipo_consulta_id); const [data, hora] = body.inicio.split('T');
    a.status = 'cancelado';   // libera o horário antigo para a conferência
    const livre = horariosLivres(d, a.profissional_id, a.tipo_consulta_id, data).includes(hora);
    if (!livre) { a.status = 'agendado'; throw erro('Este horário acabou de ser ocupado. Escolha outro.', 409); }
    a.status = 'agendado'; a.inicio = body.inicio; a.fim = data + 'T' + hhmm(min(hora) + tipo.duracao_min); a.confirmado_em = null; a.lembrete_em = null;
    dbSave(d); return { ok: true };
  }
  // Lembrete de uma consulta: na demonstração gera o link do WhatsApp com a mensagem pronta.
  if ((m = path.match(/^\/clinica\/agendamentos\/(\d+)\/lembrete$/)) && method === 'POST') {
    exigir('admin_clinica'); const a = d.agendamentos.find(x => x.id === +m[1]); if (!a) throw erro('Agendamento não encontrado.', 404);
    a.lembrete_em = new Date().toISOString(); dbSave(d);
    const msg = `Olá, ${(pac(a.paciente_id).nome || '').split(' ')[0]}! Lembrete da sua consulta em ${a.inicio.slice(8, 10)}/${a.inicio.slice(5, 7)} às ${a.inicio.slice(11, 16)}. Confirme: ${location.origin}${location.pathname.replace(/pages\/.*$/, '')}pages/confirmar.html?t=mock-${a.id}`;
    return { modo: 'link', link: 'https://wa.me/55' + String(pac(a.paciente_id).telefone || '').replace(/\D/g, '') + '?text=' + encodeURIComponent(msg) };
  }
  // Enviar todos os lembretes pendentes do dia.
  if (method === 'POST' && path === '/clinica/lembretes/enviar') {
    exigir('admin_clinica'); let n = 0;
    d.agendamentos.filter(a => a.status === 'agendado' && a.inicio.startsWith(body.data) && !a.lembrete_em && !a.confirmado_em).forEach(a => { a.lembrete_em = new Date().toISOString(); n++; });
    dbSave(d); return { enviados: n, falhas: 0 };
  }
  // Página pública do link do lembrete: ver, confirmar e cancelar (o código na demonstração é 'mock-' + número da consulta).
  if ((m = path.match(/^\/lembretes\/mock-(\d+)(\/confirmar|\/cancelar)?$/))) {
    const a = d.agendamentos.find(x => x.id === +m[1]); if (!a) throw erro('Link inválido ou vencido.', 404);
    if (method === 'POST' && m[2] === '/confirmar') { a.confirmado_em = new Date().toISOString(); dbSave(d); return { ok: true }; }
    if (method === 'POST' && m[2] === '/cancelar') { a.status = 'cancelado'; dbSave(d); return { ok: true }; }
    return { paciente: (pac(a.paciente_id).nome || '').split(' ')[0], inicio: a.inicio, status: a.status, confirmado: !!a.confirmado_em, profissional: nomeProf(a.profissional_id), tipo: nomeTipo(a.tipo_consulta_id) };
  }
  // Relatório do período: totais, por profissional e por dia.
  if (method === 'GET' && path === '/clinica/relatorio') {
    exigir('admin_clinica');
    const agora = new Date().toISOString().slice(0, 16);
    const lista = d.agendamentos.filter(a => a.inicio.slice(0, 10) >= q.de && a.inicio.slice(0, 10) <= q.ate);
    const conta = (as) => {
      const faltas = as.filter(a => a.status === 'faltou').length, canceladas = as.filter(a => a.status === 'cancelado').length;
      const futuras = as.filter(a => a.status === 'agendado' && a.inicio > agora).length;
      const atendidas = as.filter(a => a.status === 'concluido' || (a.status === 'agendado' && a.inicio <= agora)).length;
      return { total: as.length, atendidas, faltas, canceladas, futuras, taxa_faltas: atendidas + faltas ? faltas / (atendidas + faltas) * 100 : null };
    };
    const agrupa = (chave) => [...new Set(lista.map(chave))].sort().map(k => ({ k, ...conta(lista.filter(a => chave(a) === k)) }));
    return { totais: conta(lista), por_profissional: agrupa(a => a.profissional_id).map(l => ({ ...l, profissional: nomeProf(l.k) })), por_dia: agrupa(a => a.inicio.slice(0, 10)).map(l => ({ ...l, dia: l.k })) };
  }
  // Nenhuma rota serviu: erro 404. (Lembretes, bloqueios, lista de espera e relatórios não existem na API falsa.)
  throw erro('Rota não encontrada: ' + method + ' ' + path, 404);
}
