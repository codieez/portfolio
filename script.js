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
  key: ["assets/sounds/typewriter-key.ogg"],
  return: ["assets/sounds/typewriter-return.ogg"],
};
const typewriterAudioState = {
  buffers: {},
  loading: {},
  peaks: {},
};
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

function getTypewriterSource(kind) {
  const sources = typewriterAudioSources[kind] || [];
  return sources[0] || null;
}

function buildPeakWindows(buffer, segmentSeconds) {
  const sampleRate = buffer.sampleRate || 44100;
  const segmentSize = Math.max(1, Math.floor(sampleRate * segmentSeconds));
  const stepSize = Math.max(1, Math.floor(segmentSize * 0.35));
  const data = buffer.getChannelData(0);
  const peaks = [];

  for (let start = 0; start + segmentSize <= data.length; start += stepSize) {
    let energy = 0;
    let peak = 0;

    for (let index = start; index < start + segmentSize; index += 1) {
      const value = Math.abs(data[index]);
      energy += value;
      if (value > peak) peak = value;
    }

    peaks.push({ start, score: energy / segmentSize + peak * 0.6 });
  }

  peaks.sort((left, right) => right.score - left.score);
  return peaks.slice(0, 40).map((peak) => peak.start / sampleRate);
}

async function loadTypewriterBuffer(kind) {
  const source = getTypewriterSource(kind);
  if (!source) return null;

  if (typewriterAudioState.buffers[source]) return typewriterAudioState.buffers[source];
  if (!typewriterAudioState.loading[source]) {
    typewriterAudioState.loading[source] = (async () => {
      try {
        const response = await fetch(source, { cache: "force-cache" });
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        const ctx = getCtx();
        if (!ctx) return null;
        const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        typewriterAudioState.buffers[source] = buffer;
        typewriterAudioState.peaks[source] = buildPeakWindows(buffer, kind === "return" ? 0.12 : 0.07);
        return buffer;
      } catch {
        return null;
      }
    })();
  }

  return typewriterAudioState.loading[source];
}

function warmTypewriterAudio() {
  void loadTypewriterBuffer("key");
  void loadTypewriterBuffer("return");
}

function pickTypewriterWindow(kind) {
  const source = getTypewriterSource(kind);
  if (!source) return null;
  const peaks = typewriterAudioState.peaks[source] || [];
  if (!peaks.length) return null;
  return peaks[Math.floor(Math.random() * peaks.length)];
}

function playRecordedTypewriter(kind) {
  const ctx = getCtx();
  if (!ctx) return false;

  const source = getTypewriterSource(kind);
  const buffer = source ? typewriterAudioState.buffers[source] : null;
  const start = pickTypewriterWindow(kind);
  if (!buffer || start == null) return false;

  const now = ctx.currentTime;
  const segmentLength = kind === "return" ? 0.16 : 0.08;
  const playbackRate = kind === "return" ? 0.92 + Math.random() * 0.06 : 1 + Math.random() * 0.1;
  const maxStart = Math.max(0, buffer.duration - segmentLength - 0.01);
  const segmentStart = Math.min(Math.max(0, start + (Math.random() - 0.5) * 0.018), maxStart);

  const sourceNode = ctx.createBufferSource();
  sourceNode.buffer = buffer;
  sourceNode.playbackRate.value = playbackRate;

  const filter = ctx.createBiquadFilter();
  filter.type = kind === "return" ? "bandpass" : "highpass";
  filter.frequency.value = kind === "return" ? 1100 : 1700;
  filter.Q.value = kind === "return" ? 0.8 : 0.9;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(kind === "return" ? 0.16 : 0.09, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + segmentLength);

  sourceNode.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  sourceNode.start(now, segmentStart, segmentLength);
  sourceNode.stop(now + segmentLength + 0.03);
  return true;
}

function playSampleTypewriter(character = "") {
  const kind = character === "\n" ? "return" : "key";
  if (playRecordedTypewriter(kind)) return true;
  void loadTypewriterBuffer(kind);
  return false;
}

function playKeyClick() {
  const ctx = getCtx();
  if (!ctx) return;
  if (playRecordedTypewriter("key")) return;

  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.014);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const envelope = Math.exp(-i / (bufferSize * 0.16));
    data[i] = (Math.random() * 2 - 1) * envelope;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1900 + Math.random() * 250;
  filter.Q.value = 0.9;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.018, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.022);
}

function playReturn() {
  const ctx = getCtx();
  if (!ctx) return;
  if (playRecordedTypewriter("return")) return;

  const now = ctx.currentTime;
  const bufferSize = Math.floor(ctx.sampleRate * 0.03);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize) * 0.12;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 850 + Math.random() * 140;
  filter.Q.value = 0.75;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.025, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.035);
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
    warmTypewriterAudio();
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
  warmTypewriterAudio();
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
