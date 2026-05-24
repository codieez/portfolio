const pages = Array.from(document.querySelectorAll(".page"));
const navButtons = Array.from(document.querySelectorAll("#navbar .nav-btn:not(.nav-sound)"));
const typedText = document.getElementById("tw-typed-text");
const quoteText = document.getElementById("quoteText");
const quoteAttr = document.getElementById("quoteAttr");
const twCursor = document.getElementById("twCursor");
const dust = document.getElementById("dust");
const cursorOuter = document.getElementById("cursor-outer");
const cursorInner = document.getElementById("cursor-inner");
const navImg = document.getElementById("navImg");
const sndBars = Array.from(document.querySelectorAll(".sbar"));
const skillsRows = Array.from(document.querySelectorAll(".skill-row"));
const certRows = Array.from(document.querySelectorAll(".cert-row"));
const launchLink = document.querySelector(".cta-arrow-wrap");
const soundToggleButton = document.getElementById("soundToggle");
const landingPage = document.getElementById("page-landing");
const aboutParagraphs = Array.from(document.querySelectorAll("#page-about .letter-body p"));
const skillRows = Array.from(document.querySelectorAll("#page-skills .skill-row"));
const projectCards = Array.from(document.querySelectorAll("#page-projects .proj-card"));
const contactLetter = document.querySelector("#page-contact .contact-letter");
const contactRows = Array.from(document.querySelectorAll("#page-contact .contact-details li"));
const aboutDateValue = document.querySelector("#page-about .letter-meta-value");

const quotes = [
  ["It is not that we have a short time to live, but that we waste much of it.", "— Seneca"],
  ["Good code is a letter that still reads well after the ink dries.", "— Studio note"],
  ["Simplicity is the ultimate sophistication.", "— Leonardo da Vinci"],
];

const introLines = [
  "Dear reader,\n",
  "This portfolio is set up like a paper trail of engineering work.\n",
  "Each page carries a different note: about, skills, projects, certificates, and contact.\n",
  "Press the lever, follow the page turns, and the story continues."
];

const pageOrder = ["page-landing", "page-about", "page-skills", "page-projects", "page-certs", "page-contact"];
let currentPageIndex = 0;
let introStarted = false;
let transitionLock = false;
let audioCtx = null;
let soundEnabled = true;
const typewriterAudioSources = {
  key: ["assets/sounds/typewriter-ding-near-mono.wav"],
  return: ["assets/sounds/typewriter-ding-near-mono.wav"],
};
const audioPools = {};
const typingCache = {
  aboutParagraphs: aboutParagraphs.map((paragraph) => ({ element: paragraph, text: paragraph.textContent.trim() })),
  skillRows: skillRows.map((row) => ({
    bullet: row.querySelector(".skill-bullet"),
    name: row.querySelector(".skill-name-col"),
    level: row.querySelector(".skill-level"),
    bulletText: row.querySelector(".skill-bullet")?.textContent.trim() || "•",
    nameText: row.querySelector(".skill-name-col")?.textContent.trim() || "",
    levelText: row.querySelector(".skill-level")?.textContent.trim() || "",
  })),
  projectCards: projectCards.map((card) => ({
    num: card.querySelector(".proj-num"),
    title: card.querySelector(".proj-title"),
    desc: card.querySelector(".proj-desc"),
    tags: Array.from(card.querySelectorAll(".proj-tag")),
    numText: card.querySelector(".proj-num")?.textContent.trim() || "",
    titleText: card.querySelector(".proj-title")?.textContent.trim() || "",
    descText: card.querySelector(".proj-desc")?.textContent.trim() || "",
    tagTexts: Array.from(card.querySelectorAll(".proj-tag")).map((tag) => tag.textContent.trim()),
  })),
  certRows: certRows.map((row) => ({
    year: row.querySelector(".cert-year"),
    title: row.querySelector(".cert-title"),
    issuer: row.querySelector(".cert-issuer"),
    yearText: row.querySelector(".cert-year")?.textContent.trim() || "",
    titleText: row.querySelector(".cert-title")?.textContent.trim() || "",
    issuerText: row.querySelector(".cert-issuer")?.textContent.trim() || "",
  })),
  contactLetter: contactLetter ? contactLetter.textContent.trim() : "",
  contactRows: contactRows.map((row) => ({
    label: row.querySelector(".label"),
    labelText: row.querySelector(".label")?.textContent.trim() || "",
    value: row.querySelector(".contact-value"),
    valueText: row.querySelector(".contact-value")?.textContent.trim() || "",
  })),
};

function getCtx() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function createAudioPool(urls) {
  return urls.map((url) => {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = 0.25;
    return audio;
  });
}

function getPooledAudio(kind) {
  if (!audioPools[kind]) {
    audioPools[kind] = createAudioPool(typewriterAudioSources[kind] || []);
  }

  const pool = audioPools[kind];
  if (!pool.length) return null;

  const audio = pool.shift();
  pool.push(audio);
  return audio;
}

function playSampleTypewriter(character = "") {
  const kind = character === "\n" ? "return" : "key";
  const audio = getPooledAudio(kind);
  if (!audio) return false;

  try {
    audio.currentTime = 0;
    audio.volume = character === "\n" ? 0.38 : 0.18;
    audio.playbackRate = character === "\n" ? 1 : 1.08 + Math.random() * 0.12;
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === "function") {
      playResult.catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

function playKeyClick() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  const bufferSize = Math.floor(ctx.sampleRate * 0.012);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const envelope = Math.exp(-i / (bufferSize * 0.18));
    data[i] = (Math.random() * 2 - 1) * envelope;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1800 + Math.random() * 350;
  filter.Q.value = 0.9;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.02, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.018);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);

  const body = ctx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(165 + Math.random() * 25, now);
  body.frequency.exponentialRampToValueAtTime(96 + Math.random() * 16, now + 0.028);
  const bodyFilter = ctx.createBiquadFilter();
  bodyFilter.type = "lowpass";
  bodyFilter.frequency.value = 420;
  const bodyGain = ctx.createGain();
  bodyGain.gain.setValueAtTime(0.015, now);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  body.connect(bodyFilter);
  bodyFilter.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  body.start(now);

  noise.stop(now + 0.02);
  body.stop(now + 0.045);
}

function playReturn() {
  const ctx = getCtx();
  if (!ctx) return;
  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.025);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.18;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 900 + Math.random() * 180;
  filter.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.03, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.03);

  const slide = ctx.createOscillator();
  slide.type = "triangle";
  slide.frequency.setValueAtTime(140, now);
  slide.frequency.exponentialRampToValueAtTime(90, now + 0.035);
  const slideFilter = ctx.createBiquadFilter();
  slideFilter.type = "lowpass";
  slideFilter.frequency.value = 500;
  const slideGain = ctx.createGain();
  slideGain.gain.setValueAtTime(0.012, now);
  slideGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  slide.connect(slideFilter);
  slideFilter.connect(slideGain);
  slideGain.connect(ctx.destination);
  slide.start(now);
  slide.stop(now + 0.045);
}

function playTypewriterSound(character = "") {
  if (!soundEnabled) return;
  if (character === " ") return;
  if (playSampleTypewriter(character)) return;
  if (character === "\n") {
    playReturn();
    return;
  }
  playKeyClick();
}

function updateSoundToggle() {
  if (!soundToggleButton) return;
  soundToggleButton.textContent = soundEnabled ? "Sound On" : "Sound Off";
  soundToggleButton.classList.toggle("is-off", !soundEnabled);
  soundToggleButton.setAttribute("aria-pressed", String(!soundEnabled));
}

function toggleSound() {
  soundEnabled = !soundEnabled;
  updateSoundToggle();
  if (soundEnabled) {
    getCtx();
  }
}

function typeInto(target, lines, speed = 22) {
  return new Promise((resolve) => {
    target.textContent = "";
    let lineIndex = 0;
    let charIndex = 0;

    const tick = () => {
      if (lineIndex >= lines.length) {
        resolve();
        return;
      }

      const line = lines[lineIndex];
      if (charIndex < line.length) {
        const character = line[charIndex];
        target.textContent += character;
        playTypewriterSound(character);
        charIndex += 1;
        window.setTimeout(tick, character === " " ? speed + 10 : speed + Math.random() * 24);
        return;
      }

      lineIndex += 1;
      charIndex = 0;
      if (lineIndex < lines.length) target.textContent += "\n";
      window.setTimeout(tick, 120);
    };

    tick();
  });
}

function typeText(target, text, speed = 20) {
  return new Promise((resolve) => {
    target.textContent = "";
    let index = 0;

    const tick = () => {
      if (index >= text.length) {
        resolve();
        return;
      }

      const character = text[index];
      target.textContent += character;
      playTypewriterSound(character);
      index += 1;
      window.setTimeout(tick, character === " " ? speed + 8 : character === "\n" ? 110 : speed + Math.random() * 16);
    };

    tick();
  });
}

function typeRowParts(parts, speed = 18) {
  return parts.reduce((chain, part) => chain.then(() => typeText(part.element, part.text, speed)), Promise.resolve());
}

function setDynamicDate() {
  if (!aboutDateValue) return;
  const formatted = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  aboutDateValue.textContent = formatted;
}

function prepareTypedContent() {
  typingCache.aboutParagraphs.forEach(({ element }) => {
    element.textContent = "";
  });

  typingCache.skillRows.forEach(({ bullet, name, level }) => {
    if (bullet) bullet.textContent = "";
    if (name) name.textContent = "";
    if (level) level.textContent = "";
  });

  typingCache.projectCards.forEach(({ num, title, desc, tags }) => {
    if (num) num.textContent = "";
    if (title) title.textContent = "";
    if (desc) desc.textContent = "";
    tags.forEach((tag) => {
      tag.textContent = "";
    });
  });

  typingCache.certRows.forEach(({ year, title, issuer }) => {
    if (year) year.textContent = "";
    if (title) title.textContent = "";
    if (issuer) issuer.textContent = "";
  });

  if (contactLetter) {
    contactLetter.textContent = "";
  }

  contactRows.forEach((row) => {
    if (row.label) row.label.textContent = "";
    if (row.value) row.value.textContent = "";
  });
}

function setQuote() {
  const [quote, attr] = quotes[Math.floor(Math.random() * quotes.length)];
  quoteText.textContent = quote;
  quoteAttr.textContent = attr;
}

function createDust() {
  if (!dust) return;
  const count = 36;
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("span");
    particle.className = "dust-p";
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.bottom = `${Math.random() * 100}%`;
    particle.style.width = `${1 + Math.random() * 2}px`;
    particle.style.height = particle.style.width;
    particle.style.animationDuration = `${8 + Math.random() * 10}s`;
    particle.style.animationDelay = `${Math.random() * 8}s`;
    dust.appendChild(particle);
  }
}

function updateSndViz() {
  sndBars.forEach((bar, index) => {
    const height = 4 + Math.random() * (index % 2 === 0 ? 18 : 12);
    bar.style.height = `${height}px`;
    bar.style.opacity = "0.85";
  });
}

function updateNav() {
  navButtons.forEach((button, index) => {
    button.classList.toggle("active", index === currentPageIndex);
  });
}

function revealPageContent(pageId) {
  if (pageId === "page-about") {
    typingCache.aboutParagraphs.forEach(({ element, text }, index) => {
      window.setTimeout(() => typeText(element, text, 18), index * 170);
    });
  }

  if (pageId === "page-skills") {
    typingCache.skillRows.forEach((parts, index) => {
      window.setTimeout(() => {
        typeRowParts([
          { element: parts.bullet, text: parts.bulletText },
          { element: parts.name, text: parts.nameText },
          { element: parts.level, text: parts.levelText },
        ], 16);
      }, index * 220);
    });
  }

  if (pageId === "page-projects") {
    typingCache.projectCards.forEach((card, index) => {
      window.setTimeout(() => {
        typeRowParts([
          { element: card.num, text: card.numText },
          { element: card.title, text: card.titleText },
          { element: card.desc, text: card.descText },
        ], 16).then(() => {
          card.tags.forEach((tag, tagIndex) => {
            const originalTagText = card.tagTexts[tagIndex] || "";
            window.setTimeout(() => {
              typeText(tag, originalTagText, 14);
            }, tagIndex * 100);
          });
        });
      }, index * 260);
    });
  }

  if (pageId === "page-certs") {
    typingCache.certRows.forEach((parts, index) => {
      window.setTimeout(() => {
        typeRowParts([
          { element: parts.year, text: parts.yearText },
          { element: parts.title, text: parts.titleText },
          { element: parts.issuer, text: parts.issuerText },
        ], 16);
      }, index * 220);
    });
  }

  if (pageId === "page-contact") {
    if (contactLetter) {
      typeText(contactLetter, typingCache.contactLetter, 19);
    }
    typingCache.contactRows.forEach((row, index) => {
      window.setTimeout(() => {
        if (row.label) {
          typeText(row.label, row.labelText, 14).then(() => {
            if (row.value) {
              typeText(row.value, row.valueText, 14);
            }
          });
        }
      }, index * 260);
    });
  }

  if (pageId === "page-skills") {
    skillsRows.forEach((row, index) => {
      window.setTimeout(() => row.classList.add("vis"), index * 160);
    });
  }

  if (pageId === "page-certs") {
    certRows.forEach((row, index) => {
      window.setTimeout(() => row.classList.add("vis"), index * 160);
    });
  }
}

function clearTransientClasses(page) {
  page.classList.remove("slide-out-left", "slide-out-right", "slide-in-left", "slide-in-right", "arrive");
}

function gotoPage(nextIndex) {
  if (nextIndex === currentPageIndex || transitionLock) return;

  if (currentPageIndex === 0 && nextIndex === 1) {
    transitionLock = true;
    document.body.classList.add("zoom-to-letter");

    window.setTimeout(() => {
      runPageTransition(nextIndex);
    }, 460);

    window.setTimeout(() => {
      document.body.classList.remove("zoom-to-letter");
    }, 1100);

    return;
  }

  runPageTransition(nextIndex);
}

function runPageTransition(nextIndex) {
  const currentPage = pages[currentPageIndex];
  const nextPage = pages[nextIndex];
  const movingForward = nextIndex > currentPageIndex;

  transitionLock = true;

  clearTransientClasses(currentPage);
  clearTransientClasses(nextPage);

  currentPage.classList.remove("active");
  currentPage.classList.add(movingForward ? "slide-out-left" : "slide-out-right");
  nextPage.classList.add(movingForward ? "slide-in-right" : "slide-in-left");
  nextPage.classList.add("active");

  window.setTimeout(() => {
    nextPage.classList.add("arrive");
  }, 20);

  window.setTimeout(() => {
    clearTransientClasses(currentPage);
  }, 720);

  window.setTimeout(() => {
    clearTransientClasses(nextPage);
    nextPage.classList.add("active");
    updateNav();
    revealPageContent(nextPage.id);
    transitionLock = false;
  }, 760);

  currentPageIndex = nextIndex;
  updateNav();
}

window.gotoPage = gotoPage;

navButtons.forEach((button, index) => {
  button.addEventListener("click", () => gotoPage(index));
});

launchLink?.addEventListener("click", () => {
  gotoPage(1);
});

function moveCursor(event) {
  if (!cursorOuter || !cursorInner) return;
  const transform = `translate(${event.clientX}px, ${event.clientY}px) translate(-50%, -50%)`;
  cursorOuter.style.transform = transform;
  cursorInner.style.transform = transform;
}

window.addEventListener("pointermove", moveCursor);
window.addEventListener("pointerdown", () => cursorOuter?.classList.add("pressed"));
window.addEventListener("pointerup", () => cursorOuter?.classList.remove("pressed"));

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") gotoPage(Math.min(currentPageIndex + 1, pages.length - 1));
  if (event.key === "ArrowLeft") gotoPage(Math.max(currentPageIndex - 1, 0));
});

function startLandingType() {
  if (introStarted) return;
  introStarted = true;
  if (soundEnabled) getCtx();
  typeInto(typedText, introLines, 20);
}

function animateLanding() {
  setDynamicDate();
  prepareTypedContent();
  setQuote();
  startLandingType();
  updateSndViz();
  window.setInterval(updateSndViz, 120);
}

window.addEventListener("load", () => {
  createDust();
  animateLanding();
  updateNav();
  updateSoundToggle();
  soundToggleButton?.addEventListener("click", toggleSound);
  revealPageContent("page-landing");
});
