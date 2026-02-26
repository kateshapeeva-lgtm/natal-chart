const API_BASE = 'https://natal-chart-backend-6nxr.onrender.com';
const form = document.getElementById('natal-form');
const timeUnknownCheckbox = document.getElementById('time-unknown');
const timeInput = document.getElementById('birth-time');
const resultSection = document.getElementById('result');
const formError = document.getElementById('form-error');
const chartCanvas = document.getElementById('chart-canvas');
const saveButton = document.getElementById('save-chart');
const savedListContainer = document.getElementById('saved-list');

const summaryBlock = document.getElementById('summary-block');
const planetsBlock = document.getElementById('planets-block');
const aspectsBlock = document.getElementById('aspects-block');

const STORAGE_KEY = 'natal_charts_v1';

timeUnknownCheckbox.addEventListener('change', () => {
  if (timeUnknownCheckbox.checked) {
    timeInput.dataset.originalValue = timeInput.value;
    timeInput.value = '';
    timeInput.disabled = true;
  } else {
    timeInput.disabled = false;
    if (timeInput.dataset.originalValue) {
      timeInput.value = timeInput.dataset.originalValue;
    }
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  formError.hidden = true;
  formError.textContent = '';

  const formData = new FormData(form);
  const name = (formData.get('name') || '').toString().trim();
  const gender = (formData.get('gender') || '').toString();
  const birthDate = (formData.get('birthDate') || '').toString();
  const birthTime = timeUnknownCheckbox.checked
    ? ''
    : (formData.get('birthTime') || '').toString();
  const birthPlace = (formData.get('birthPlace') || '').toString().trim();

  if (!birthDate || !birthPlace) {
    showFormError('Пожалуйста, заполни дату и место рождения.');
    return;
  }

  const parsed = safeParseDateTime(birthDate, birthTime);
  if (!parsed) {
    showFormError('Дата или время рождения выглядят странно. Проверь, пожалуйста, ещё раз.');
    return;
  }

  const profile = {
    id: crypto.randomUUID(),
    name: name || 'Без имени',
    gender,
    birthDate,
    birthTime: birthTime || null,
    timeUnknown: timeUnknownCheckbox.checked,
    birthPlace,
    createdAt: new Date().toISOString(),
  };

  const chart = buildSimplifiedChart(profile, parsed);

  renderChart(chart);
  renderInterpretation(profile, chart);
  resultSection.hidden = false;
  scrollToElement(resultSection);

  saveButton.onclick = () => {
    saveChart(profile, chart);
  };
});

function showFormError(message) {
  formError.hidden = false;
  formError.textContent = message;
}

function safeParseDateTime(dateStr, timeStr) {
  try {
    const [year, month, day] = dateStr.split('-').map((v) => parseInt(v, 10));
    if (!year || !month || !day) return null;

    let hours = 12;
    let minutes = 0;
    if (timeStr) {
      const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
      if (Number.isNaN(h) || Number.isNaN(m)) return null;
      hours = h;
      minutes = m;
    }

    const date = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    if (Number.isNaN(date.getTime())) return null;

    return { date, year, month, day, hours, minutes };
  } catch {
    return null;
  }
}

function buildSimplifiedChart(profile, parsed) {
  const { month, day, hours } = parsed;

  const sunSignIndex = month - 1;
  const moonSignIndex = (month + Math.floor(day / 2)) % 12;
  const ascendantIndex = Math.floor(((hours + 6) % 24) / 2);

  const signs = [
    'Овен',
    'Телец',
    'Близнецы',
    'Рак',
    'Лев',
    'Дева',
    'Весы',
    'Скорпион',
    'Стрелец',
    'Козерог',
    'Водолей',
    'Рыбы',
  ];

  const sunSign = signs[sunSignIndex];
  const moonSign = signs[moonSignIndex];
  const ascendantSign = signs[ascendantIndex];

  const planets = [
    { name: 'Солнце', key: 'sun', sign: sunSign },
    { name: 'Луна', key: 'moon', sign: moonSign },
    { name: 'Венера', key: 'venus', sign: signs[(sunSignIndex + 2) % 12] },
    { name: 'Марс', key: 'mars', sign: signs[(sunSignIndex + 4) % 12] },
    { name: 'Меркурий', key: 'mercury', sign: signs[(sunSignIndex + 1) % 12] },
    { name: 'Юпитер', key: 'jupiter', sign: signs[(sunSignIndex + 6) % 12] },
  ];

  const aspects = [
    {
      type: 'harmonious',
      between: ['Солнце', 'Луна'],
    },
    {
      type: 'challenging',
      between: ['Луна', 'Марс'],
    },
  ];

  return {
    sunSign,
    moonSign,
    ascendantSign,
    planets,
    aspects,
    profile,
  };
}

function renderChart(chart) {
  if (!chartCanvas || !chartCanvas.getContext) return;
  const ctx = chartCanvas.getContext('2d');
  const { width, height } = chartCanvas;
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(width, height) / 2 - 12;
  const innerRadius = outerRadius * 0.55;

  ctx.clearRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(cx, cy - 40, 40, cx, cy, outerRadius);
  gradient.addColorStop(0, '#151a3b');
  gradient.addColorStop(1, '#050818');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius + 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
  ctx.stroke();

  const planetCount = chart.planets.length;
  chart.planets.forEach((planet, index) => {
    const angle = (index / planetCount) * Math.PI * 2 - Math.PI / 2;
    const r = (innerRadius + outerRadius) / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    const isSun = planet.key === 'sun';
    const isMoon = planet.key === 'moon';

    const color = isSun
      ? '#ffb86b'
      : isMoon
      ? '#c58cff'
      : 'rgba(255,255,255,0.9)';

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, isSun ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - innerRadius);
  ctx.lineTo(cx, cy + innerRadius);
  ctx.moveTo(cx - innerRadius, cy);
  ctx.lineTo(cx + innerRadius, cy);
  ctx.stroke();
}

function renderInterpretation(profile, chart) {
  const summaryHtml = buildSummaryText(profile, chart);
  const planetsHtml = buildPlanetsText(chart);
  const aspectsHtml = buildAspectsText(chart);

  summaryBlock.innerHTML = summaryHtml;
  planetsBlock.innerHTML = planetsHtml;
  aspectsBlock.innerHTML = aspectsHtml;
}

function buildSummaryText(profile, chart) {
  const name = profile.name && profile.name !== 'Без имени' ? profile.name : 'Ты';

  const timePart = profile.timeUnknown
    ? 'точное время рождения неизвестно, поэтому мы смотрим больше на общую энергию дня.'
    : 'учитывая и дату, и примерное время рождения.';

  return `
    <h4>Общая картинка про тебя</h4>
    <p>
      ${name} родилась с Солнцем в знаке ${chart.sunSign} и Луной в знаке ${
    chart.moonSign
  }.
      Это уже даёт очень особенную смесь твоей «внешней» энергии и внутреннего мира.
    </p>
    <p>
      Асцендент (то, как ты можешь проявляться для окружающих) у тебя в знаке ${
        chart.ascendantSign
      }.
      Это про первое впечатление о тебе и про тот стиль, в котором ты обычно заходишь в новые ситуации.
    </p>
    <p>
      Мы делаем расчёт в упрощённом формате, ${timePart}
      Но и этого уже достаточно, чтобы поймать общий характер твоей карты — без
      катастроф и страшилок, просто мягкое описание твоих привычных реакций.
    </p>
  `;
}

function buildPlanetsText(chart) {
  const groups = [
    {
      title: 'Личная энергия и характер',
      keys: ['sun', 'moon', 'asc'],
      description:
        'Здесь собраны твои базовые настройки: как ты чувствуешь себя изнутри и как проявляешься снаружи.',
    },
    {
      title: 'Про чувства и отношения',
      keys: ['venus', 'moon'],
      description:
        'Этот блок — про нежность, близость и то, как тебе комфортно строить отношения с людьми.',
    },
    {
      title: 'Про действия и цели',
      keys: ['mars', 'mercury', 'jupiter'],
      description:
        'Здесь виден твой стиль в делах, амбициях и в том, как ты двигаешься к своим желаниям.',
    },
  ];

  const byKey = {};
  chart.planets.forEach((p) => {
    byKey[p.key] = p;
  });

  let html = '';

  groups.forEach((group) => {
    const relevantPlanets = group.keys
      .map((key) => (key === 'asc' ? null : byKey[key]))
      .filter(Boolean);

    if (!relevantPlanets.length) return;

    html += `<div class="interpretation-block">`;
    html += `<h4>${group.title}</h4>`;
    html += `<p>${group.description}</p>`;
    html += `<ul>`;

    relevantPlanets.forEach((planet) => {
      html += `<li>${buildPlanetLine(planet)}</li>`;
    });

    html += `</ul></div>`;
  });

  return html;
}

function buildPlanetLine(planet) {
  const sign = planet.sign;

  if (planet.key === 'sun') {
    return `Солнце в ${sign} — это про твой базовый характер и то, как ты
    естественно проявляешь себя, когда ни под кого не подстраиваешься. В этом
    знаке много твоей «основной» энергии, на которую ты можешь опираться.`;
  }

  if (planet.key === 'moon') {
    return `Луна в ${sign} — это про твои эмоции, внутренние качели и то, что
    помогает тебе чувствовать себя в безопасности. Так ты обычно реагируешь,
    когда что‑то происходит неожиданно — почти автоматически.`;
  }

  if (planet.key === 'venus') {
    return `Венера в ${sign} показывает, как ты любишь, как проявляешь заботу и
    что для тебя красиво и притягательно. Это и про твой вкус, и про формат
    отношений, в которых тебе по‑настоящему комфортно.`;
  }

  if (planet.key === 'mars') {
    return `Марс в ${sign} описывает, как ты берёшься за дела и защищаешь свои
    границы. Это твой стиль «я так делаю» — иногда мягко, иногда по‑боевому,
    но по‑своему честно.`;
  }

  if (planet.key === 'mercury') {
    return `Меркурий в ${sign} — про то, как ты думаешь, общаешься и воспринимаешь
    информацию. В этом знаке виден твой тип мышления: больше про логику,
    интуицию, разговоры или наблюдения.`;
  }

  if (planet.key === 'jupiter') {
    return `Юпитер в ${sign} подсказывает, где тебе легче всего расти, расширяться
    и замечать удачные совпадения. Это область, где жизнь как будто чаще говорит
    тебе «да».`;
  }

  return `${planet.name} в ${sign} добавляет свой оттенок в твою карту — это тоже часть твоей общей энергии.`;
}

function buildAspectsText(chart) {
  if (!chart.aspects.length) {
    return `
      <div class="interpretation-block">
        <h4>Как планеты общаются между собой</h4>
        <p>
          В этой карте мы смотрим только на самые базовые связи между планетами.
          Даже на таком упрощённом уровне уже видно, какие части твоего характера
          легко договариваются между собой, а где могут быть лёгкие внутренние
          качели.
        </p>
      </div>
    `;
  }

  let html = `
    <div class="interpretation-block">
      <h4>Как планеты общаются между собой</h4>
      <p>
        Здесь — несколько важных связок между планетами. Можно представить, что
        каждая планета — это часть тебя, и они иногда обнимаются, а иногда чуть
        спорят друг с другом.
      </p>
      <ul>
  `;

  chart.aspects.forEach((aspect) => {
    const [a, b] = aspect.between;
    if (aspect.type === 'harmonious') {
      html += `<li>
        Между ${a} и ${b} чувствуется тёплая, поддерживающая связка. Одна часть
        тебя как будто говорит другой: «я с тобой, давай вместе». Такие моменты
        обычно переживаются мягко и естественно.
      </li>`;
    } else if (aspect.type === 'challenging') {
      html += `<li>
        Связь между ${a} и ${b} может давать внутренние качели: то хочется в одну
        сторону, то в другую. Это не «плохо», скорее зона роста — там, где ты
        учишься договариваться сама с собой и находить свой баланс.
      </li>`;
    }
  });

  html += `</ul></div>`;
  return html;
}

function saveChart(profile, chart) {
  try {
    const existing = loadSavedCharts();
    const item = {
      id: profile.id,
      name: profile.name,
      birthDate: profile.birthDate,
      birthTime: profile.birthTime,
      birthPlace: profile.birthPlace,
      createdAt: profile.createdAt,
      data: { profile, chart },
    };

    const updated = [item, ...existing.filter((c) => c.id !== item.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    renderSavedCharts();
  } catch {
    alert('Не получилось сохранить карту. Попробуй ещё раз чуть позже.');
  }
}

function loadSavedCharts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function renderSavedCharts() {
  const saved = loadSavedCharts();

  if (!saved.length) {
    savedListContainer.innerHTML =
      '<p class="empty-state">Пока здесь пусто. Сначала рассчитай и сохрани свою карту.</p>';
    return;
  }

  const list = document.createElement('div');
  list.className = 'saved-list';

  saved.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'saved-item';

    const main = document.createElement('div');
    main.className = 'saved-main';

    const nameEl = document.createElement('div');
    nameEl.className = 'saved-name';
    nameEl.textContent = item.name || 'Без имени';

    const metaEl = document.createElement('div');
    metaEl.className = 'saved-meta';
    const date = new Date(item.birthDate);
    const dateStr = !Number.isNaN(date.getTime())
      ? date.toLocaleDateString('ru-RU')
      : item.birthDate;
    metaEl.textContent = `${dateStr}, ${item.birthPlace}`;

    main.appendChild(nameEl);
    main.appendChild(metaEl);

    const actions = document.createElement('div');
    actions.className = 'saved-actions';

    const openBtn = document.createElement('button');
    openBtn.textContent = 'Открыть';
    openBtn.onclick = () => {
      const { profile, chart } = item.data;
      renderChart(chart);
      renderInterpretation(profile, chart);
      resultSection.hidden = false;
      scrollToElement(resultSection);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Удалить';
    deleteBtn.onclick = () => {
      const filtered = saved.filter((c) => c.id !== item.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      renderSavedCharts();
    };

    actions.appendChild(openBtn);
    actions.appendChild(deleteBtn);

    row.appendChild(main);
    row.appendChild(actions);
    list.appendChild(row);
  });

  savedListContainer.innerHTML = '';
  savedListContainer.appendChild(list);
}

function scrollToElement(element) {
  const rect = element.getBoundingClientRect();
  const absoluteY = rect.top + window.scrollY - 80;
  window.scrollTo({
    top: absoluteY,
    behavior: 'smooth',
  });
}

renderSavedCharts();



