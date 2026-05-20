/* ================================================================
   quiz.js — Lógica completa del Concurso XML/DTD
   Funcionalidades:
     · Carga de preguntas desde XML mediante AJAX
     · Presentación tipo "slide" pregunta a pregunta
     · Reloj cronómetro en tiempo real
     · Puntuación acumulada con feedback inmediato
     · Soporte bilingüe (español / inglés)
   ================================================================ */

'use strict';

/* ── Traducciones de la interfaz ──────────────────────────────── */
const i18n = {
  es: {
    title:        '🧠 Concurso XML & DTD',
    startTitle:   '¿Cuánto sabes de XML?',
    startDesc:    'Responde 20 preguntas sobre XML y DTD.\nTienes todo el tiempo que necesites.\n¡Buena suerte!',
    startBtn:     'Comenzar',
    question:     'Pregunta',
    of:           'de',
    score:        'Puntos',
    correct:      '¡Correcto! 🎉',
    wrong:        'Incorrecto. La respuesta correcta era:',
    next:         'Siguiente →',
    finish:       'Ver resultados',
    resultTitle:  (s, t) => s === t ? '¡Perfecto! 🏆' : s >= t * 0.7 ? '¡Muy bien! 👏' : '¡Sigue practicando! 💪',
    resultSub:    (s, t) => `Has acertado ${s} de ${t} preguntas`,
    statScore:    'Puntuación',
    statTime:     'Tiempo',
    statPct:      'Aciertos',
    playAgain:    'Volver a jugar',
    loading:      'Cargando preguntas…',
    langLabel:    'Idioma:',
  },
  en: {
    title:        '🧠 XML & DTD Quiz',
    startTitle:   'How well do you know XML?',
    startDesc:    'Answer 20 questions about XML and DTD.\nTake as much time as you need.\nGood luck!',
    startBtn:     'Start',
    question:     'Question',
    of:           'of',
    score:        'Score',
    correct:      'Correct! 🎉',
    wrong:        'Wrong. The correct answer was:',
    next:         'Next →',
    finish:       'See results',
    resultTitle:  (s, t) => s === t ? 'Perfect! 🏆' : s >= t * 0.7 ? 'Well done! 👏' : 'Keep practising! 💪',
    resultSub:    (s, t) => `You got ${s} out of ${t} questions right`,
    statScore:    'Score',
    statTime:     'Time',
    statPct:      'Accuracy',
    playAgain:    'Play again',
    loading:      'Loading questions…',
    langLabel:    'Language:',
  }
};

/* ── Estado de la aplicación ───────────────────────────────────── */
let lang        = 'es';          // idioma activo
let questions   = [];            // array de objetos {wording, choices:[{text, correct}]}
let current     = 0;             // índice de la pregunta actual
let score       = 0;             // puntos acumulados
let answered    = false;         // si ya respondió la pregunta actual
let timerSecs   = 0;             // segundos transcurridos
let timerHandle = null;          // handle del setInterval del reloj

/* ── Referencias a elementos del DOM ──────────────────────────── */
const elTitle       = document.getElementById('app-title');
const elStartScreen = document.getElementById('start-screen');
const elQuizScreen  = document.getElementById('quiz-screen');
const elResultScreen= document.getElementById('results-screen');
const elLoader      = document.getElementById('loader');

const elStartTitle  = document.getElementById('start-title');
const elStartDesc   = document.getElementById('start-desc');
const elStartBtn    = document.getElementById('start-btn');

const elProgressTxt = document.getElementById('progress-text');
const elTimerDisp   = document.getElementById('timer-display');
const elScoreBadge  = document.getElementById('score-badge');
const elProgressFill= document.getElementById('progress-fill');

const elQNum        = document.getElementById('q-num');
const elQText       = document.getElementById('q-text');
const elChoices     = document.getElementById('choices');
const elFeedback    = document.getElementById('feedback');
const elNextBtn     = document.getElementById('next-btn');

const elResTitle    = document.getElementById('res-title');
const elResSub      = document.getElementById('res-sub');
const elResScore    = document.getElementById('res-score');
const elResTime     = document.getElementById('res-time');
const elResPct      = document.getElementById('res-pct');
const elResBar      = document.getElementById('res-bar');
const elReplayBtn   = document.getElementById('replay-btn');

/* ── Cambio de idioma ──────────────────────────────────────────── */
function setLang(newLang) {
  lang = newLang;

  /* Botones de idioma */
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  /* Actualizar textos de la UI */
  const t = i18n[lang];
  elTitle.textContent      = t.title;
  elStartTitle.textContent = t.startTitle;
  elStartDesc.textContent  = t.startDesc;
  elStartBtn.textContent   = t.startBtn;
}

/* ── Formatear tiempo mm:ss ────────────────────────────────────── */
function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/* ── Arrancar / parar reloj ────────────────────────────────────── */
function startTimer() {
  timerSecs = 0;
  elTimerDisp.textContent = formatTime(0);
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    timerSecs++;
    elTimerDisp.textContent = formatTime(timerSecs);
  }, 1000);
}

function stopTimer() {
  clearInterval(timerHandle);
  timerHandle = null;
}

/* ── Cargar XML mediante AJAX ──────────────────────────────────── */
/**
 * Realiza una petición AJAX GET al fichero XML correspondiente al idioma,
 * parsea el XML y construye el array `questions`.
 *
 * Estructura del XML esperada:
 *   <test>
 *     <question id="...">
 *       <wording>Texto de la pregunta</wording>
 *       <choices>
 *         <choice correct="yes|no">Texto de la opción</choice>
 *         ...
 *       </choices>
 *     </question>
 *   </test>
 */
function loadQuestions(callback) {
  const file = `xml/questions_${lang}.xml`;

  /* Mostrar loader */
  elStartScreen.style.display  = 'none';
  elLoader.style.display       = 'flex';
  elLoader.querySelector('p').textContent = i18n[lang].loading;

  const xhr = new XMLHttpRequest();
  xhr.open('GET', file, true);

  xhr.onload = function () {
    if (xhr.status !== 200 && xhr.status !== 0) {
      alert(`Error al cargar ${file}: HTTP ${xhr.status}`);
      elLoader.style.display = 'none';
      elStartScreen.style.display = 'block';
      return;
    }

    /* Parsear el XML */
    const xml = xhr.responseXML ||
                new DOMParser().parseFromString(xhr.responseText, 'text/xml');

    const qNodes = xml.getElementsByTagName('question');
    questions = [];

    /* Recorrer cada <question> y extraer datos */
    for (let i = 0; i < qNodes.length; i++) {
      const wording = qNodes[i].getElementsByTagName('wording')[0].childNodes[0].nodeValue;
      const choiceNodes = qNodes[i].getElementsByTagName('choice');
      const choices = [];

      for (let j = 0; j < choiceNodes.length; j++) {
        choices.push({
          text:    choiceNodes[j].childNodes[0].nodeValue,
          correct: choiceNodes[j].getAttribute('correct') === 'yes'
        });
      }

      questions.push({ wording, choices });
    }

    /* Mezclar preguntas aleatoriamente para mayor dinamismo */
    shuffleArray(questions);

    elLoader.style.display = 'none';
    callback();
  };

  xhr.onerror = function () {
    /* Si falla (ej: CORS en local), cargamos preguntas de muestra */
    console.warn('AJAX falló — usando preguntas de muestra locales.');
    questions = getFallbackQuestions(lang);
    shuffleArray(questions);
    elLoader.style.display = 'none';
    callback();
  };

  xhr.send();
}

/* ── Mezclar array (Fisher-Yates) ─────────────────────────────── */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ── Iniciar quiz ──────────────────────────────────────────────── */
function startQuiz() {
  loadQuestions(() => {
    current  = 0;
    score    = 0;
    answered = false;

    elQuizScreen.style.display   = 'block';
    elResultScreen.style.display = 'none';
    elStartScreen.style.display  = 'none';

    startTimer();
    renderQuestion();
  });
}

/* ── Renderizar pregunta actual ────────────────────────────────── */
function renderQuestion() {
  const t = i18n[lang];
  const q = questions[current];
  answered = false;

  /* Progreso */
  const total = questions.length;
  elProgressTxt.textContent =
    `${t.question} ${current + 1} ${t.of} ${total}`;
  elProgressFill.style.width = `${((current) / total) * 100}%`;
  elScoreBadge.textContent   = `${t.score}: ${score}`;

  /* Número y texto */
  elQNum.textContent  = `${t.question} ${current + 1}`;
  elQText.textContent = q.wording;

  /* Limpiar opciones anteriores */
  elChoices.innerHTML = '';
  elFeedback.className   = 'feedback';
  elFeedback.innerHTML   = '';
  elFeedback.style.display = 'none';
  elNextBtn.style.display  = 'none';

  /* Mezclar opciones */
  const opts = [...q.choices];
  shuffleArray(opts);

  /* Crear botones de respuesta */
  const letters = ['A', 'B', 'C', 'D'];
  opts.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `
      <span class="choice-letter">${letters[idx]}</span>
      <span class="choice-text">${opt.text}</span>`;
    btn.dataset.correct = opt.correct;
    btn.addEventListener('click', () => handleAnswer(btn, opts));
    elChoices.appendChild(btn);
  });

  /* Animar entrada */
  document.querySelector('.question-card').style.animation = 'none';
  requestAnimationFrame(() => {
    document.querySelector('.question-card').style.animation = '';
  });
}

/* ── Gestionar respuesta del usuario ──────────────────────────── */
function handleAnswer(selectedBtn, opts) {
  if (answered) return;
  answered = true;

  const t = i18n[lang];
  const isCorrect = selectedBtn.dataset.correct === 'true';

  /* Deshabilitar todos los botones */
  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.correct === 'true') btn.classList.add('correct');
  });

  if (isCorrect) {
    /* Respuesta correcta */
    selectedBtn.classList.add('correct');
    score++;
    elFeedback.className = 'feedback correct';
    elFeedback.innerHTML = `✅ ${t.correct}`;
  } else {
    /* Respuesta incorrecta — resaltar la correcta */
    selectedBtn.classList.add('wrong');
    const correctText = opts.find(o => o.correct).text;
    elFeedback.className = 'feedback wrong';
    elFeedback.innerHTML = `❌ ${t.wrong} <strong>${correctText}</strong>`;
  }

  elFeedback.style.display = 'flex';

  /* Mostrar botón siguiente / finalizar */
  elNextBtn.style.display   = 'block';
  elNextBtn.textContent     = current < questions.length - 1 ? t.next : t.finish;
  elScoreBadge.textContent  = `${t.score}: ${score}`;
}

/* ── Ir a la siguiente pregunta o resultados ───────────────────── */
function nextQuestion() {
  current++;
  if (current < questions.length) {
    renderQuestion();
  } else {
    showResults();
  }
}

/* ── Mostrar pantalla de resultados ────────────────────────────── */
function showResults() {
  stopTimer();

  const t     = i18n[lang];
  const total = questions.length;
  const pct   = Math.round((score / total) * 100);

  elQuizScreen.style.display   = 'none';
  elResultScreen.style.display = 'block';

  /* Rellenar datos */
  document.getElementById('res-emoji').textContent =
    score === total ? '🏆' : score >= total * 0.7 ? '👏' : '💪';

  elResTitle.textContent = t.resultTitle(score, total);
  elResSub.textContent   = t.resultSub(score, total);

  elResScore.querySelector('.stat-value').textContent = `${score}/${total}`;
  elResScore.querySelector('.stat-label').textContent = t.statScore;

  elResTime.querySelector('.stat-value').textContent  = formatTime(timerSecs);
  elResTime.querySelector('.stat-label').textContent  = t.statTime;

  elResPct.querySelector('.stat-value').textContent   = `${pct}%`;
  elResPct.querySelector('.stat-label').textContent   = t.statPct;

  /* Barra animada */
  elResBar.style.width = '0%';
  requestAnimationFrame(() => {
    setTimeout(() => { elResBar.style.width = `${pct}%`; }, 100);
  });

  elReplayBtn.textContent = t.playAgain;
}

/* ── Reiniciar ─────────────────────────────────────────────────── */
function replay() {
  elResultScreen.style.display = 'none';
  elStartScreen.style.display  = 'block';
}

/* ── Preguntas de emergencia (si AJAX falla en local) ─────────── */
function getFallbackQuestions(language) {
  const data = {
    es: [
      { wording: '¿Qué significa XML?',
        choices: [
          { text: 'eXtensible Markup Language', correct: true },
          { text: 'Extra Modern Language', correct: false },
          { text: 'eXtended Machine Logic', correct: false },
          { text: 'Extensible Management Layer', correct: false }
        ]},
      { wording: '¿Qué significa DTD?',
        choices: [
          { text: 'Document Type Definition', correct: true },
          { text: 'Data Transfer Document', correct: false },
          { text: 'Dynamic Type Definition', correct: false },
          { text: 'Default Tag Declaration', correct: false }
        ]},
      { wording: '¿Qué indica el símbolo + en un DTD?',
        choices: [
          { text: 'Una o más veces', correct: true },
          { text: 'Cero o más veces', correct: false },
          { text: 'Exactamente una vez', correct: false },
          { text: 'Elemento opcional', correct: false }
        ]},
      { wording: '¿Qué tipo de atributo garantiza unicidad en DTD?',
        choices: [
          { text: 'ID', correct: true },
          { text: 'CDATA', correct: false },
          { text: 'NMTOKEN', correct: false },
          { text: 'IDREF', correct: false }
        ]},
      { wording: '¿Cómo se declara un DTD externo?',
        choices: [
          { text: '<!DOCTYPE test SYSTEM "quiz.dtd">', correct: true },
          { text: '<!DOCTYPE test INCLUDE "quiz.dtd">', correct: false },
          { text: '<!DOCTYPE test LINK "quiz.dtd">', correct: false },
          { text: '<?dtd href="quiz.dtd"?>', correct: false }
        ]}
    ],
    en: [
      { wording: 'What does XML stand for?',
        choices: [
          { text: 'eXtensible Markup Language', correct: true },
          { text: 'Extra Modern Language', correct: false },
          { text: 'eXtended Machine Logic', correct: false },
          { text: 'Extensible Management Layer', correct: false }
        ]},
      { wording: 'What does DTD stand for?',
        choices: [
          { text: 'Document Type Definition', correct: true },
          { text: 'Data Transfer Document', correct: false },
          { text: 'Dynamic Type Definition', correct: false },
          { text: 'Default Tag Declaration', correct: false }
        ]},
      { wording: "What does '+' mean in a DTD?",
        choices: [
          { text: 'One or more times', correct: true },
          { text: 'Zero or more times', correct: false },
          { text: 'Exactly once', correct: false },
          { text: 'Optional element', correct: false }
        ]},
      { wording: 'Which attribute type guarantees uniqueness in DTD?',
        choices: [
          { text: 'ID', correct: true },
          { text: 'CDATA', correct: false },
          { text: 'NMTOKEN', correct: false },
          { text: 'IDREF', correct: false }
        ]},
      { wording: 'How do you link an external DTD?',
        choices: [
          { text: '<!DOCTYPE test SYSTEM "quiz.dtd">', correct: true },
          { text: '<!DOCTYPE test INCLUDE "quiz.dtd">', correct: false },
          { text: '<!DOCTYPE test LINK "quiz.dtd">', correct: false },
          { text: '<?dtd href="quiz.dtd"?>', correct: false }
        ]}
    ]
  };
  return data[language] || data.es;
}

/* ── Eventos ───────────────────────────────────────────────────── */
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => setLang(btn.dataset.lang));
});

elStartBtn.addEventListener('click', startQuiz);
elNextBtn.addEventListener('click', nextQuestion);
elReplayBtn.addEventListener('click', replay);

/* ── Inicializar con idioma por defecto ────────────────────────── */
setLang('es');
