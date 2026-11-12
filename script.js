(() => {
    "use strict";

    /* =====================================================================
       UTILITÁRIOS
       ===================================================================== */
    const $ = seletor => document.querySelector(seletor);
    const sorteio = lista => lista[Math.floor(Math.random() * lista.length)];
    const reduzirMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const plural = (n, um, varios) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;
    const DIA = 86400000;

    function criar(tag, props = {}, filhos = []) {
        const el = document.createElement(tag);
        for (const [chave, valor] of Object.entries(props)) {
            if (valor === undefined || valor === null || valor === false) continue;
            if (chave === "class") el.className = valor;
            else if (chave === "text") el.textContent = valor;
            else if (chave.startsWith("on")) el.addEventListener(chave.slice(2), valor);
            else el.setAttribute(chave, valor === true ? "" : valor);
        }
        for (const filho of [].concat(filhos)) if (filho) el.append(filho);
        return el;
    }

    let timerToast;
    function avisar(texto) {
        const toast = $("#toast");
        toast.textContent = texto;
        toast.classList.add("visivel");
        clearTimeout(timerToast);
        timerToast = setTimeout(() => toast.classList.remove("visivel"), 3200);
    }

    async function copiar(texto) {
        try {
            await navigator.clipboard.writeText(texto);
            return true;
        } catch {
            const area = criar("textarea", { readonly: true, style: "position:fixed;opacity:0" });
            area.value = texto;
            document.body.append(area);
            area.select();
            let ok = false;
            try { ok = document.execCommand("copy"); } catch { /* sem suporte */ }
            area.remove();
            return ok;
        }
    }

    /* =====================================================================
       CONFIGURAÇÃO
       Ordem de prioridade: link compartilhado (#c=...) → salvo neste
       navegador → config.js
       ===================================================================== */
    const PADRAO = {
        titulo: "Nosso Tempo Juntos",
        nome1: "",
        nome2: "",
        inicio: "2026-06-20T00:00",
        fotos: ["Foto1.jpg", "Foto2.jpg", "Foto3.jpg"],
        trocaFotosSegundos: 5,
        musicas: [],
        carta: "",
        motivos: [],
    };
    const CHAVE_LOCAL = "site-namoro-config";

    function lerData(texto) {
        const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(typeof texto === "string" ? texto : "");
        if (!m) return null;
        const data = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
        return Number.isNaN(data.getTime()) ? null : data;
    }

    const texto = (valor, padrao, max) => (typeof valor === "string" ? valor.slice(0, max) : padrao);
    const lista = (valor, padrao, maxItens, maxTamanho) => Array.isArray(valor)
        ? valor.filter(item => typeof item === "string")
            .map(item => item.trim().slice(0, maxTamanho))
            .filter(Boolean)
            .slice(0, maxItens)
        : padrao;

    function normalizar(entrada, base) {
        const c = entrada && typeof entrada === "object" ? entrada : {};
        const troca = Number(c.trocaFotosSegundos);
        return {
            titulo: texto(c.titulo, base.titulo, 80).trim() || PADRAO.titulo,
            nome1: texto(c.nome1, base.nome1, 40).trim(),
            nome2: texto(c.nome2, base.nome2, 40).trim(),
            inicio: lerData(c.inicio) ? c.inicio.slice(0, 16) : base.inicio,
            fotos: lista(c.fotos, base.fotos, 60, 800),
            trocaFotosSegundos: Number.isFinite(troca) && troca > 0
                ? Math.min(60, Math.max(3, Math.round(troca)))
                : base.trocaFotosSegundos,
            musicas: lista(c.musicas, base.musicas, 30, 800),
            carta: texto(c.carta, base.carta, 5000),
            motivos: lista(c.motivos, base.motivos, 100, 300),
        };
    }

    const BASE = normalizar(window.CONFIG_SITE, PADRAO);

    function codificar(objeto) {
        const bytes = new TextEncoder().encode(JSON.stringify(objeto));
        let binario = "";
        bytes.forEach(b => { binario += String.fromCharCode(b); });
        return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }

    function decodificar(texto64) {
        try {
            const binario = atob(texto64.replace(/-/g, "+").replace(/_/g, "/"));
            const bytes = Uint8Array.from(binario, ch => ch.charCodeAt(0));
            return JSON.parse(new TextDecoder().decode(bytes));
        } catch {
            return null;
        }
    }

    function configDoLink() {
        const m = /[#&]c=([\w-]+)/.exec(location.hash);
        return m ? decodificar(m[1]) : null;
    }

    function configLocal() {
        try { return JSON.parse(localStorage.getItem(CHAVE_LOCAL)); } catch { return null; }
    }

    function carregarConfig() {
        const doLink = configDoLink();
        if (doLink) return { cfg: normalizar(doLink, BASE), origem: "link" };
        const local = configLocal();
        if (local) return { cfg: normalizar(local, BASE), origem: "local" };
        return { cfg: BASE, origem: "codigo" };
    }

    // No link só vai o que é diferente do config.js, para ficar mais curto
    function diferencasDaBase(cfg) {
        const saida = {};
        for (const chave of Object.keys(cfg)) {
            if (JSON.stringify(cfg[chave]) !== JSON.stringify(BASE[chave])) saida[chave] = cfg[chave];
        }
        return saida;
    }

    let { cfg, origem } = carregarConfig();

    /* =====================================================================
       LINKS DE FOTOS E MÚSICAS
       Só gera iframes de endereços conhecidos (Instagram, Spotify...),
       nunca de um link qualquer.
       ===================================================================== */
    function lerUrl(textoUrl) {
        try {
            const u = new URL(textoUrl);
            return u.protocol === "https:" || u.protocol === "http:" ? u : null;
        } catch {
            return null;
        }
    }
    const hostDe = u => u.hostname.toLowerCase().replace(/^(www|m|mobile|web)\./, "");
    const RE_ARQUIVO = /^[\w\-. ()À-ÿ/]+\.(jpe?g|png|gif|webp|avif|svg)$/i;
    const RE_REDE_CURTA = /^(spotify\.link|vm\.tiktok\.com|vt\.tiktok\.com|pin\.it|deezer\.page\.link|link\.deezer\.com|on\.soundcloud\.com|instagr\.am)$/;

    function lerFoto(linha) {
        if (!/^[a-z][a-z0-9+.-]*:/i.test(linha)) {
            return RE_ARQUIVO.test(linha) && !linha.includes("..")
                ? { tipo: "img", src: linha, rede: "Arquivo da pasta" }
                : { erro: "Não é um link nem um arquivo de imagem (.jpg, .png...)" };
        }
        const u = lerUrl(linha);
        if (!u) return { erro: "Link inválido" };
        const host = hostDe(u);
        let m;

        if (RE_REDE_CURTA.test(host)) {
            return { erro: "Link encurtado: abra no navegador e copie o endereço completo que aparecer" };
        }
        if (host === "instagram.com" || host.endsWith(".instagram.com")) {
            m = /\/(p|reel|reels|tv)\/([\w-]+)/.exec(u.pathname);
            if (!m) return { erro: "Use o link de uma publicação (…/p/…), não do perfil ou dos stories" };
            const tipo = m[1] === "p" || m[1] === "tv" ? "p" : "reel";
            return { tipo: "embed", src: `https://www.instagram.com/${tipo}/${m[2]}/embed/`, rede: "Instagram" };
        }
        if (host === "tiktok.com") {
            m = /\/(?:video|photo)\/(\d+)/.exec(u.pathname);
            return m
                ? { tipo: "embed", src: `https://www.tiktok.com/embed/v2/${m[1]}`, rede: "TikTok" }
                : { erro: "Use o link completo do vídeo (…/video/…)" };
        }
        if (/(^|\.)pinterest\.[a-z.]+$/.test(host)) {
            m = /\/pin\/(?:[\w-]*--)?(\d+)/.exec(u.pathname);
            return m
                ? { tipo: "embed", src: `https://assets.pinterest.com/ext/embed.html?id=${m[1]}`, rede: "Pinterest" }
                : { erro: "Use o link de um pin (…/pin/…)" };
        }
        if (host === "facebook.com" || host === "fb.watch") {
            const video = /\/(videos|reel|watch)\b/.test(u.pathname) || host === "fb.watch";
            const plugin = video ? "video.php" : "post.php";
            return {
                tipo: "embed",
                src: `https://www.facebook.com/plugins/${plugin}?href=${encodeURIComponent(u.href)}&show_text=false&width=500`,
                rede: "Facebook",
            };
        }
        if (host === "twitter.com" || host === "x.com") {
            m = /\/status(?:es)?\/(\d+)/.exec(u.pathname);
            return m
                ? { tipo: "embed", src: `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&theme=dark&dnt=true`, rede: "X (Twitter)" }
                : { erro: "Use o link de um post (…/status/…)" };
        }
        if (host === "drive.google.com") {
            m = /\/d\/([\w-]+)/.exec(u.pathname);
            const id = m ? m[1] : u.searchParams.get("id");
            return id && /^[\w-]+$/.test(id)
                ? { tipo: "img", src: `https://drive.google.com/thumbnail?id=${id}&sz=w2000`, rede: "Google Drive" }
                : { erro: "Use o link de um arquivo do Drive (…/file/d/…), não de uma pasta" };
        }
        if (host === "photos.app.goo.gl" || host === "photos.google.com") {
            return { erro: "O Google Fotos não deixa abrir fora do app. Abra a foto, clique com o botão direito e use “Copiar endereço da imagem”" };
        }
        if (host === "dropbox.com") {
            u.searchParams.delete("dl");
            u.searchParams.set("raw", "1");
            return { tipo: "img", src: u.href, rede: "Dropbox" };
        }
        if (host === "imgur.com") {
            m = /^\/([A-Za-z0-9]{5,8})$/.exec(u.pathname);
            return m
                ? { tipo: "img", src: `https://i.imgur.com/${m[1]}.jpg`, rede: "Imgur" }
                : { erro: "Use o link de uma imagem só, não de álbum" };
        }
        return { tipo: "img", src: u.href, rede: "Imagem da internet" };
    }

    function separarNome(linha) {
        const i = linha.indexOf("|");
        if (i === -1) return { nome: "", link: linha.trim() };
        return { nome: linha.slice(0, i).trim().slice(0, 40), link: linha.slice(i + 1).trim() };
    }

    function lerMusica(link) {
        const u = lerUrl(link);
        if (!u) return { erro: "Link inválido" };
        const host = hostDe(u);
        let m;

        if (RE_REDE_CURTA.test(host)) {
            return { erro: "Link encurtado: abra no navegador e copie o endereço completo que aparecer" };
        }
        if (host === "open.spotify.com") {
            m = /^\/(?:intl-[\w-]+\/)?(?:embed\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/.exec(u.pathname);
            return m
                ? { src: `https://open.spotify.com/embed/${m[1]}/${m[2]}?utm_source=generator&theme=0`, altura: 152, rede: "Spotify" }
                : { erro: "Use o link de uma música, álbum ou playlist do Spotify" };
        }
        if (host === "youtube.com" || host === "music.youtube.com" || host === "youtu.be") {
            let id = null;
            if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
            else if (u.searchParams.get("v")) id = u.searchParams.get("v");
            else if ((m = /^\/(?:shorts|embed|live)\/([\w-]+)/.exec(u.pathname))) id = m[1];
            const playlist = u.searchParams.get("list");
            if (id && /^[\w-]{6,15}$/.test(id)) {
                return { src: `https://www.youtube-nocookie.com/embed/${id}`, altura: 200, rede: "YouTube" };
            }
            if (playlist && /^[\w-]+$/.test(playlist)) {
                return { src: `https://www.youtube-nocookie.com/embed/videoseries?list=${playlist}`, altura: 200, rede: "YouTube" };
            }
            return { erro: "Use o link de um vídeo ou playlist do YouTube" };
        }
        if (host === "deezer.com") {
            m = /^\/(?:[a-z]{2}\/)?(track|album|playlist)\/(\d+)/.exec(u.pathname);
            return m
                ? { src: `https://widget.deezer.com/widget/dark/${m[1]}/${m[2]}`, altura: 152, rede: "Deezer" }
                : { erro: "Use o link de uma música, álbum ou playlist do Deezer" };
        }
        if (host === "music.apple.com") {
            return /^\/[a-z]{2}\/(album|playlist|song)\//.test(u.pathname)
                ? { src: `https://embed.music.apple.com${u.pathname}${u.search}`, altura: u.searchParams.has("i") || u.pathname.includes("/song/") ? 175 : 450, rede: "Apple Music" }
                : { erro: "Use o link de uma música, álbum ou playlist do Apple Music" };
        }
        if (host === "soundcloud.com") {
            return {
                src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.origin + u.pathname)}&color=%23ff4d6d&auto_play=false&visual=false`,
                altura: 166,
                rede: "SoundCloud",
            };
        }
        return { erro: "Site de música não reconhecido" };
    }

    /* =====================================================================
       CONTADOR
       Conta anos e meses pelo calendário (20/06 → 20/07 = 1 mês),
       não por média de 30 dias.
       ===================================================================== */
    function somarMeses(data, n) {
        const d = new Date(data.getTime());
        const dia = d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth() + n);
        const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(dia, ultimoDia));
        return d;
    }

    function somarDias(data, n) {
        const d = new Date(data.getTime());
        d.setDate(d.getDate() + n);
        return d;
    }

    const inicioDoDia = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diasEntre = (a, b) => Math.round((inicioDoDia(b) - inicioDoDia(a)) / DIA);

    function diferenca(de, ate) {
        let totalMeses = (ate.getFullYear() - de.getFullYear()) * 12 + ate.getMonth() - de.getMonth();
        if (somarMeses(de, totalMeses) > ate) totalMeses--;
        const ancora = somarMeses(de, totalMeses);

        let dias = diasEntre(ancora, ate);
        if (somarDias(ancora, dias) > ate) dias--;
        const resto = ate - somarDias(ancora, dias);

        return {
            anos: Math.floor(totalMeses / 12),
            meses: totalMeses % 12,
            dias,
            horas: Math.floor(resto / 3600000),
            minutos: Math.floor(resto % 3600000 / 60000),
            segundos: Math.floor(resto % 60000 / 1000),
            totalMeses,
            ancora,
            totalDias: diasEntre(de, ate) - (somarDias(de, diasEntre(de, ate)) > ate ? 1 : 0),
        };
    }

    const campos = ["anos", "meses", "dias", "horas", "minutos", "segundos"]
        .reduce((obj, id) => ({ ...obj, [id]: document.getElementById(id) }), {});

    function definir(el, valor) {
        if (el.textContent === valor) return;
        el.textContent = valor;
        if (reduzirMovimento) return;
        el.classList.remove("pulo");
        void el.offsetWidth; // reinicia a animação
        el.classList.add("pulo");
    }

    const doisDigitos = n => String(n).padStart(2, "0");
    let festaFeita = false;

    function atualizarContador() {
        const inicio = lerData(cfg.inicio) || lerData(PADRAO.inicio);
        const agora = new Date();
        const futuro = inicio > agora;
        const d = futuro ? diferenca(agora, inicio) : diferenca(inicio, agora);

        definir(campos.anos, String(d.anos));
        definir(campos.meses, String(d.meses));
        definir(campos.dias, String(d.dias));
        definir(campos.horas, doisDigitos(d.horas));
        definir(campos.minutos, doisDigitos(d.minutos));
        definir(campos.segundos, doisDigitos(d.segundos));
        $("#rAnos").textContent = d.anos === 1 ? "Ano" : "Anos";
        $("#rMeses").textContent = d.meses === 1 ? "Mês" : "Meses";
        $("#rDias").textContent = d.dias === 1 ? "Dia" : "Dias";

        const total = $("#total");
        const marco = $("#marco");

        if (futuro) {
            total.textContent = `Faltam ${plural(d.totalDias, "dia", "dias")} no total`;
            marco.textContent = "Contagem regressiva para o grande dia 💞";
            marco.classList.remove("festa");
            return;
        }

        const horasTotais = Math.floor((agora - inicio) / 3600000);
        total.textContent = `São ${plural(d.totalDias, "dia", "dias")} ou ${plural(horasTotais, "hora", "horas")} juntos`;

        // Hoje é dia especial?
        let hoje = null;
        if (d.totalMeses > 0 && diasEntre(d.ancora, agora) === 0) {
            hoje = d.totalMeses % 12 === 0 ? plural(d.totalMeses / 12, "ano", "anos") : plural(d.totalMeses, "mês", "meses");
        } else if (d.totalDias > 0 && d.totalDias % 100 === 0) {
            hoje = plural(d.totalDias, "dia", "dias");
        }

        if (hoje) {
            marco.textContent = `🎉 Hoje completamos ${hoje}! 🎉`;
            marco.classList.add("festa");
            if (!festaFeita && !reduzirMovimento) {
                festaFeita = true;
                setTimeout(() => {
                    const r = $(".container").getBoundingClientRect();
                    for (let i = 0; i < 5; i++) {
                        setTimeout(() => estourar(r.left + Math.random() * r.width, r.top + Math.random() * r.height * 0.5), i * 250);
                    }
                }, 1200);
            }
            return;
        }

        // Próximo marco: o próximo "mêsversário" ou a próxima centena de dias
        const n = d.totalMeses + 1;
        const opcoes = [
            { data: somarMeses(inicio, n), nome: n % 12 === 0 ? plural(n / 12, "ano", "anos") : plural(n, "mês", "meses") },
            (() => {
                const centena = (Math.floor(d.totalDias / 100) + 1) * 100;
                return { data: somarDias(inicio, centena), nome: plural(centena, "dia", "dias") };
            })(),
        ].sort((a, b) => a.data - b.data);

        const proximo = opcoes[0];
        const faltam = diasEntre(agora, proximo.data);
        marco.classList.remove("festa");
        marco.textContent = faltam <= 0
            ? `Hoje à noite completamos ${proximo.nome} 💞`
            : `${faltam === 1 ? "Falta 1 dia" : `Faltam ${faltam} dias`} para completarmos ${proximo.nome} 💞`;
    }

    /* =====================================================================
       FOTOS
       ===================================================================== */
    const slider = $("#slider");
    const sliderFundo = $("#sliderFundo");
    const pontos = $("#pontos");
    const contagemFotos = $("#contagemFotos");
    let slides = [];
    let atual = 0;
    let timerFotos = null;
    let pausado = false;
    let fotosLocais = []; // { id, url }

    function montarFotos() {
        slider.querySelectorAll(".slide").forEach(el => el.remove());
        pontos.replaceChildren();
        clearTimeout(timerFotos);

        const daConfig = cfg.fotos.map(lerFoto).filter(f => !f.erro);
        const doAparelho = fotosLocais.map(f => ({ tipo: "img", src: f.url, rede: "Deste aparelho" }));
        slides = [...daConfig, ...doAparelho];
        atual = 0;

        slides.forEach((slide, i) => {
            if (slide.tipo === "img") {
                slide.el = criar("img", {
                    class: "slide",
                    alt: `Nossa foto ${i + 1}`,
                    decoding: "async",
                    referrerpolicy: "no-referrer",
                    draggable: "false",
                });
                slide.el.addEventListener("load", () => {
                    slide.ok = true;
                    atualizarVazio();
                    if (i === atual) mostrar(atual);
                });
                slide.el.addEventListener("error", () => {
                    slide.falhou = true;
                    atualizarVazio();
                    if (i === atual) mudarFoto(1);
                });
            } else {
                slide.el = criar("div", { class: "slide embed" }, criar("div", { class: "carregando", text: `Carregando ${slide.rede}…` }));
            }
            slider.insertBefore(slide.el, $("#fotoAnterior"));

            if (slides.length <= 10) {
                pontos.append(criar("button", {
                    class: "ponto",
                    type: "button",
                    "aria-label": `Ver foto ${i + 1}`,
                    onclick: () => irPara(i),
                }));
            }
        });

        contagemFotos.hidden = slides.length <= 10;
        slider.classList.toggle("um", slides.length === 1);
        atualizarVazio();
        if (slides.length) mostrar(0);
        else sliderFundo.style.backgroundImage = "";
    }

    function atualizarVazio() {
        const validos = slides.filter(s => !s.falhou);
        const vazio = validos.length === 0;
        slider.classList.toggle("vazio", vazio);
        slider.classList.toggle("um", validos.length === 1);
        $("#semFotoTexto").textContent = slides.length
            ? "Não consegui carregar as fotos. Confira os links em ⚙ Personalizar"
            : "Adicione fotos em ⚙ Personalizar";
    }

    function carregar(i) {
        const slide = slides[i];
        if (!slide) return;
        if (slide.tipo === "img") {
            if (!slide.el.getAttribute("src")) slide.el.src = slide.src;
        } else if (!slide.el.querySelector("iframe")) {
            slide.el.append(criar("iframe", {
                src: slide.src,
                title: `Publicação do ${slide.rede}`,
                loading: "lazy",
                allow: "encrypted-media; picture-in-picture; fullscreen",
                allowfullscreen: true,
                referrerpolicy: "strict-origin-when-cross-origin",
            }));
        }
    }

    function mostrar(i) {
        const slide = slides[i];
        if (!slide) return;
        carregar(i);
        carregar((i + 1) % slides.length);
        slides.forEach((s, j) => s.el.classList.toggle("ativo", j === i));
        [...pontos.children].forEach((p, j) => p.classList.toggle("ativo", j === i));
        contagemFotos.textContent = `${i + 1} / ${slides.length}`;
        sliderFundo.style.backgroundImage = slide.tipo === "img" && !slide.falhou
            ? `url("${urlCss(slide.el.currentSrc || slide.src)}")`
            : "";
        agendar();
    }

    const urlCss = endereco => endereco.replace(/["\\\n\r]/g, ch => encodeURIComponent(ch));

    function irPara(i) {
        if (!slides.length) return;
        atual = ((i % slides.length) + slides.length) % slides.length;
        mostrar(atual);
    }

    function mudarFoto(direcao) {
        if (!slides.length || slides.every(s => s.falhou)) return;
        let i = atual;
        for (let tentativas = 0; tentativas < slides.length; tentativas++) {
            i = (i + direcao + slides.length) % slides.length;
            if (!slides[i].falhou) break;
        }
        irPara(i);
    }

    function agendar() {
        clearTimeout(timerFotos);
        if (reduzirMovimento || slides.filter(s => !s.falhou).length < 2) return;
        // Não passa sozinho quando está numa publicação (Instagram, TikTok...)
        if (slides[atual] && slides[atual].tipo === "embed") return;
        timerFotos = setTimeout(() => {
            if (document.hidden || pausado || !$("#lightbox").hidden) agendar();
            else mudarFoto(1);
        }, cfg.trocaFotosSegundos * 1000);
    }

    $("#fotoAnterior").addEventListener("click", () => mudarFoto(-1));
    $("#fotoProxima").addEventListener("click", () => mudarFoto(1));
    slider.addEventListener("mouseenter", () => { pausado = true; });
    slider.addEventListener("mouseleave", () => { pausado = false; });

    let toqueX = null;
    let arrastou = false;
    slider.addEventListener("touchstart", e => { toqueX = e.touches[0].clientX; arrastou = false; }, { passive: true });
    slider.addEventListener("touchend", e => {
        if (toqueX === null) return;
        const dx = e.changedTouches[0].clientX - toqueX;
        if (Math.abs(dx) > 40) { arrastou = true; mudarFoto(dx < 0 ? 1 : -1); }
        toqueX = null;
    });

    slider.addEventListener("click", e => {
        if (arrastou) { arrastou = false; return; }
        if (e.target.matches("img.slide.ativo")) abrirLightbox();
    });

    /* ---------- Foto em tela cheia ---------- */
    const lightbox = $("#lightbox");
    const lbImagem = $("#lbImagem");

    function abrirLightbox() {
        const slide = slides[atual];
        if (!slide || slide.tipo !== "img") return;
        lbImagem.src = slide.el.currentSrc || slide.src;
        abrirModal(lightbox);
    }

    function navegarLightbox(direcao) {
        const imagens = slides.map((s, i) => ({ s, i })).filter(({ s }) => s.tipo === "img" && !s.falhou);
        if (imagens.length < 2) return;
        const pos = Math.max(0, imagens.findIndex(({ i }) => i === atual));
        const alvo = imagens[(pos + direcao + imagens.length) % imagens.length];
        irPara(alvo.i);
        lbImagem.src = alvo.s.el.currentSrc || alvo.s.src;
    }

    $("#lbAnterior").addEventListener("click", () => navegarLightbox(-1));
    $("#lbProxima").addEventListener("click", () => navegarLightbox(1));
    let lbToqueX = null;
    lightbox.addEventListener("touchstart", e => { lbToqueX = e.touches[0].clientX; }, { passive: true });
    lightbox.addEventListener("touchend", e => {
        if (lbToqueX === null) return;
        const dx = e.changedTouches[0].clientX - lbToqueX;
        if (Math.abs(dx) > 40) navegarLightbox(dx < 0 ? 1 : -1);
        lbToqueX = null;
    });

    /* =====================================================================
       MÚSICAS
       ===================================================================== */
    const listaMusicas = $("#listaMusicas");
    const player = $("#player");
    let musicas = [];

    function montarMusicas() {
        musicas = cfg.musicas
            .map((linha, i) => {
                const { nome, link } = separarNome(linha);
                const m = lerMusica(link);
                return m.erro ? null : { ...m, nome: nome || `Música ${i + 1}` };
            })
            .filter(Boolean);

        listaMusicas.replaceChildren();
        player.replaceChildren();
        player.hidden = musicas.length === 0;
        listaMusicas.hidden = musicas.length < 2;

        musicas.forEach((m, i) => {
            listaMusicas.append(criar("button", {
                class: "chip",
                type: "button",
                text: `♪ ${m.nome}`,
                title: m.rede,
                onclick: () => tocar(i),
            }));
        });
        if (musicas.length) tocar(0);
    }

    function tocar(i) {
        const m = musicas[i];
        if (!m) return;
        [...listaMusicas.children].forEach((chip, j) => chip.classList.toggle("ativo", j === i));
        const atualIframe = player.querySelector("iframe");
        if (atualIframe && atualIframe.getAttribute("src") === m.src) return;
        player.replaceChildren(criar("iframe", {
            src: m.src,
            height: m.altura,
            title: `${m.nome} (${m.rede})`,
            loading: "lazy",
            allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
            allowfullscreen: true,
            referrerpolicy: "strict-origin-when-cross-origin",
        }));
    }

    /* =====================================================================
       CARTINHA, MOTIVOS E COMPARTILHAR
       ===================================================================== */
    const modalCarta = $("#modalCarta");
    const envelope = $("#envelope");
    const papel = $("#papel");
    const papelTexto = $("#papelTexto");
    let timerDigitacao = null;

    function abrirCarta() {
        clearInterval(timerDigitacao);
        envelope.hidden = false;
        envelope.classList.remove("abrindo");
        papel.hidden = true;
        abrirModal(modalCarta);
        envelope.focus();
    }

    function revelarCarta() {
        envelope.classList.add("abrindo");
        estourarNoElemento(envelope);
        setTimeout(() => {
            envelope.hidden = true;
            papel.hidden = false;
            const assinatura = cfg.nome1 ? `Com amor, ${cfg.nome1} ❤` : "Com amor ❤";
            $("#papelAssinatura").textContent = assinatura;
            digitar(cfg.carta);
        }, reduzirMovimento ? 0 : 650);
    }

    function digitar(conteudo) {
        clearInterval(timerDigitacao);
        if (reduzirMovimento) { papelTexto.textContent = conteudo; return; }
        const letras = Array.from(conteudo);
        let i = 0;
        papelTexto.textContent = "";
        timerDigitacao = setInterval(() => {
            papelTexto.textContent += letras.slice(i, i + 2).join("");
            i += 2;
            if (i >= letras.length) clearInterval(timerDigitacao);
        }, 30);
    }

    envelope.addEventListener("click", revelarCarta);
    papel.addEventListener("click", () => { // toque para ver tudo de uma vez
        clearInterval(timerDigitacao);
        papelTexto.textContent = cfg.carta;
    });
    $("#abrirCarta").addEventListener("click", abrirCarta);

    let ultimoMotivo = -1;
    $("#sortearMotivo").addEventListener("click", e => {
        if (!cfg.motivos.length) return;
        let i = Math.floor(Math.random() * cfg.motivos.length);
        if (cfg.motivos.length > 1 && i === ultimoMotivo) i = (i + 1) % cfg.motivos.length;
        ultimoMotivo = i;
        const motivo = $("#motivo");
        motivo.hidden = false;
        motivo.textContent = cfg.motivos[i];
        motivo.classList.remove("novo");
        void motivo.offsetWidth;
        motivo.classList.add("novo");
        estourarNoElemento(e.currentTarget);
    });

    $("#compartilhar").addEventListener("click", async () => {
        const dados = { title: cfg.titulo, text: "Olha o nosso contador ❤", url: location.href };
        if (navigator.share) {
            try { await navigator.share(dados); } catch { /* cancelado */ }
            return;
        }
        avisar(await copiar(location.href) ? "Link copiado!" : "Não consegui copiar o link");
    });

    /* =====================================================================
       JANELAS (cartinha, foto ampliada, personalizar)
       ===================================================================== */
    let focoAnterior = null;

    function abrirModal(modal) {
        focoAnterior = document.activeElement;
        modal.hidden = false;
        document.body.classList.add("travado");
        const fechar = modal.querySelector("[data-fechar]");
        if (fechar) fechar.focus({ preventScroll: true });
    }

    function fecharModal(modal) {
        if (modal.hidden) return;
        modal.hidden = true;
        if (modal === modalCarta) clearInterval(timerDigitacao);
        if (![...document.querySelectorAll(".modal")].some(m => !m.hidden)) document.body.classList.remove("travado");
        if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus({ preventScroll: true });
    }

    document.querySelectorAll(".modal").forEach(modal => {
        modal.addEventListener("click", e => {
            if (e.target === modal || e.target.closest("[data-fechar]")) fecharModal(modal);
        });
    });

    document.addEventListener("keydown", e => {
        const aberto = [...document.querySelectorAll(".modal")].reverse().find(m => !m.hidden);
        if (e.key === "Escape" && aberto) { fecharModal(aberto); return; }
        if (aberto === lightbox) {
            if (e.key === "ArrowRight") navegarLightbox(1);
            if (e.key === "ArrowLeft") navegarLightbox(-1);
            return;
        }
        if (aberto) return;
        const digitando = e.target.closest && e.target.closest("input, textarea, select");
        if (digitando) return;
        if (e.key === "ArrowRight") mudarFoto(1);
        if (e.key === "ArrowLeft") mudarFoto(-1);
    });

    /* =====================================================================
       FOTOS DO APARELHO (ficam salvas no navegador, IndexedDB)
       ===================================================================== */
    const banco = {
        abrir() {
            return new Promise((ok, erro) => {
                if (!("indexedDB" in window)) { erro(new Error("Sem IndexedDB")); return; }
                const req = indexedDB.open("site-namoro", 1);
                req.onupgradeneeded = () => req.result.createObjectStore("fotos", { keyPath: "id", autoIncrement: true });
                req.onsuccess = () => ok(req.result);
                req.onerror = () => erro(req.error);
            });
        },
        async usar(modo, acao) {
            const db = await this.abrir();
            return new Promise((ok, erro) => {
                const tx = db.transaction("fotos", modo);
                const req = acao(tx.objectStore("fotos"));
                tx.oncomplete = () => { db.close(); ok(req && req.result); };
                tx.onerror = () => { db.close(); erro(tx.error); };
                tx.onabort = () => { db.close(); erro(tx.error); };
            });
        },
        todas() { return this.usar("readonly", loja => loja.getAll()); },
        adicionar(blob) { return this.usar("readwrite", loja => loja.add({ blob, criada: Date.now() })); },
        remover(id) { return this.usar("readwrite", loja => loja.delete(id)); },
    };

    async function carregarFotosLocais() {
        fotosLocais.forEach(f => URL.revokeObjectURL(f.url));
        try {
            const registros = await banco.todas();
            fotosLocais = registros.map(r => ({ id: r.id, url: URL.createObjectURL(r.blob) }));
        } catch {
            fotosLocais = [];
        }
    }

    async function reduzirImagem(arquivo) {
        try {
            const bitmap = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
            const maximo = 1600;
            const escala = Math.min(1, maximo / Math.max(bitmap.width, bitmap.height));
            const canvas = criar("canvas");
            canvas.width = Math.round(bitmap.width * escala);
            canvas.height = Math.round(bitmap.height * escala);
            canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            if (bitmap.close) bitmap.close();
            const blob = await new Promise(ok => canvas.toBlob(ok, "image/jpeg", 0.85));
            return blob || arquivo;
        } catch {
            return arquivo;
        }
    }

    /* =====================================================================
       PERSONALIZAR
       ===================================================================== */
    const painel = $("#painel");
    const form = $("#formPainel");
    const campo = id => document.getElementById(id);
    const linhas = valor => valor.split("\n").map(l => l.trim()).filter(Boolean);

    const TEXTO_ORIGEM = {
        codigo: "Mostrando o que está no config.js.",
        local: "Mostrando as mudanças salvas neste navegador.",
        link: "Mostrando a versão do link que você abriu.",
    };

    function preencherPainel() {
        campo("pTitulo").value = cfg.titulo;
        campo("pNome1").value = cfg.nome1;
        campo("pNome2").value = cfg.nome2;
        campo("pInicio").value = cfg.inicio;
        campo("pFotos").value = cfg.fotos.join("\n");
        campo("pTroca").value = cfg.trocaFotosSegundos;
        campo("pMusicas").value = cfg.musicas.join("\n");
        campo("pCarta").value = cfg.carta;
        campo("pMotivos").value = cfg.motivos.join("\n");
        $("#pOrigem").textContent = TEXTO_ORIGEM[origem];
        mostrarStatus();
        desenharMiniaturas();
    }

    function lerPainel() {
        return normalizar({
            titulo: campo("pTitulo").value,
            nome1: campo("pNome1").value,
            nome2: campo("pNome2").value,
            inicio: campo("pInicio").value || cfg.inicio,
            fotos: linhas(campo("pFotos").value),
            trocaFotosSegundos: campo("pTroca").value,
            musicas: linhas(campo("pMusicas").value),
            carta: campo("pCarta").value.trim(),
            motivos: linhas(campo("pMotivos").value),
        }, BASE);
    }

    function itemStatus(linha, resultado, rotulo) {
        const curto = linha.length > 60 ? linha.slice(0, 57) + "…" : linha;
        return resultado.erro
            ? criar("li", { class: "erro", text: `✗ ${curto}: ${resultado.erro}` })
            : criar("li", { class: "ok", text: `✓ ${rotulo || resultado.rede}: ${curto}` });
    }

    function mostrarStatus() {
        $("#pFotosStatus").replaceChildren(...linhas(campo("pFotos").value).slice(0, 60)
            .map(l => itemStatus(l, lerFoto(l))));
        $("#pMusicasStatus").replaceChildren(...linhas(campo("pMusicas").value).slice(0, 30)
            .map(l => {
                const { nome, link } = separarNome(l);
                const r = lerMusica(link);
                return itemStatus(link, r, r.erro ? "" : `${r.rede}${nome ? ` (${nome})` : ""}`);
            }));
    }

    function desenharMiniaturas() {
        $("#pLocais").replaceChildren(...fotosLocais.map(f => criar("div", { class: "miniatura" }, [
            criar("img", { src: f.url, alt: "Foto deste aparelho" }),
            criar("button", {
                type: "button",
                text: "×",
                "aria-label": "Remover foto",
                onclick: async () => {
                    try { await banco.remover(f.id); } catch { /* já removida */ }
                    await carregarFotosLocais();
                    desenharMiniaturas();
                    montarFotos();
                },
            }),
        ])));
    }

    campo("pFotos").addEventListener("input", mostrarStatus);
    campo("pMusicas").addEventListener("input", mostrarStatus);

    campo("pArquivos").addEventListener("change", async e => {
        const arquivos = [...e.target.files].filter(a => a.type.startsWith("image/"));
        e.target.value = "";
        if (!arquivos.length) return;
        avisar(`Preparando ${plural(arquivos.length, "foto", "fotos")}…`);
        let salvas = 0;
        for (const arquivo of arquivos.slice(0, 40)) {
            try {
                await banco.adicionar(await reduzirImagem(arquivo));
                salvas++;
            } catch { /* espaço cheio ou navegador sem suporte */ }
        }
        await carregarFotosLocais();
        desenharMiniaturas();
        montarFotos();
        avisar(salvas
            ? `${plural(salvas, "foto adicionada", "fotos adicionadas")} neste aparelho`
            : "Não consegui salvar as fotos neste navegador");
    });

    function salvarLocal(nova) {
        try {
            localStorage.setItem(CHAVE_LOCAL, JSON.stringify(nova));
            return true;
        } catch {
            return false;
        }
    }

    function limparLinkDaBarra() {
        if (/[#&]c=/.test(location.hash)) history.replaceState(null, "", location.pathname + location.search);
    }

    form.addEventListener("submit", e => {
        e.preventDefault();
        const nova = lerPainel();
        const salvou = salvarLocal(nova);
        limparLinkDaBarra();
        cfg = nova;
        origem = salvou ? "local" : origem;
        aplicar();
        fecharModal(painel);
        avisar(salvou ? "Salvo neste navegador ❤" : "Mudanças aplicadas, mas este navegador não deixou salvar");
    });

    campo("pLink").addEventListener("click", async () => {
        const nova = lerPainel();
        const diferencas = diferencasDaBase(nova);
        const base = location.origin + location.pathname;
        const link = Object.keys(diferencas).length ? `${base}#c=${codificar(diferencas)}` : base;
        const copiou = await copiar(link);
        if (location.protocol === "file:") {
            avisar("Link copiado, mas ele só funciona depois que o site estiver publicado (GitHub Pages)");
        } else if (fotosLocais.length) {
            avisar(copiou ? "Link copiado! As fotos do aparelho não vão junto" : "Não consegui copiar o link");
        } else {
            avisar(copiou ? "Link copiado! É só mandar ❤" : "Não consegui copiar o link");
        }
    });

    campo("pCodigo").addEventListener("click", async () => {
        const nova = lerPainel();
        const conteudo = "/* Configuração do site. Gerado pelo botão Personalizar. */\n"
            + `window.CONFIG_SITE = ${JSON.stringify(nova, null, 4)};\n`;
        avisar(await copiar(conteudo)
            ? "Copiado! Substitua todo o conteúdo do config.js por ele"
            : "Não consegui copiar");
    });

    let confirmarRestaurar = null;
    campo("pRestaurar").addEventListener("click", e => {
        const botao = e.currentTarget;
        if (!confirmarRestaurar) {
            botao.textContent = "Clique de novo para confirmar";
            confirmarRestaurar = setTimeout(() => {
                botao.textContent = "Restaurar padrão";
                confirmarRestaurar = null;
            }, 3500);
            return;
        }
        clearTimeout(confirmarRestaurar);
        confirmarRestaurar = null;
        botao.textContent = "Restaurar padrão";
        try { localStorage.removeItem(CHAVE_LOCAL); } catch { /* sem acesso */ }
        limparLinkDaBarra();
        cfg = BASE;
        origem = "codigo";
        aplicar();
        preencherPainel();
        avisar("Voltou para o que está no config.js");
    });

    $("#abrirPainel").addEventListener("click", () => {
        preencherPainel();
        abrirModal(painel);
    });

    /* =====================================================================
       APLICAR A CONFIGURAÇÃO NA TELA
       ===================================================================== */
    function aplicar() {
        $("#titulo").textContent = cfg.titulo;
        document.title = cfg.titulo;

        const nomes = $("#nomes");
        const juntos = [cfg.nome1, cfg.nome2].filter(Boolean);
        nomes.hidden = juntos.length === 0;
        nomes.textContent = juntos.join(" ❤ ");

        const inicio = lerData(cfg.inicio) || lerData(PADRAO.inicio);
        const futuro = inicio > new Date();
        $("#desdeTexto").textContent = futuro ? "Contando os dias até" : "Juntos desde";
        $("#dataTexto").textContent = inicio.toLocaleDateString("pt-BR");

        $("#abrirCarta").hidden = !cfg.carta.trim();
        $("#sortearMotivo").hidden = cfg.motivos.length === 0;
        $("#motivo").hidden = true;

        festaFeita = false;
        atualizarContador();
        montarFotos();
        montarMusicas();
    }

    /* =====================================================================
       EFEITOS: corações, explosões, estrelas e flores
       ===================================================================== */
    const camada = $("#coracoes");
    const simbolos = ["❤", "❤", "❤", "💗", "💕", "💖"];
    const cores = ["#ff4d6d", "#ff758f", "#c9184a", "#ff8fa3", "#ffb3c1"];

    function criarCoracao() {
        if (document.hidden) return;
        const tamanho = Math.random() * 18 + 10;
        const duracao = Math.random() * 4 + 5;
        const dentro = criar("i", { text: sorteio(simbolos) });
        dentro.style.animationDuration = (Math.random() * 1.5 + 1.5) + "s";

        const coracao = criar("div", { class: "heart" }, dentro);
        coracao.style.left = Math.random() * 100 + "vw";
        coracao.style.fontSize = tamanho + "px";
        coracao.style.color = sorteio(cores);
        coracao.style.opacity = (Math.random() * 0.5 + 0.4).toFixed(2);
        coracao.style.filter = `drop-shadow(0 0 ${tamanho / 2}px rgba(255, 77, 109, .7))`;
        coracao.style.animationDuration = duracao + "s";
        coracao.style.setProperty("--giro", (Math.random() * 120 - 60) + "deg");

        camada.append(coracao);
        setTimeout(() => coracao.remove(), duracao * 1000);
    }

    function estourar(x, y) {
        if (reduzirMovimento) return;
        const quantidade = 12;
        for (let i = 0; i < quantidade; i++) {
            const angulo = (Math.PI * 2 * i) / quantidade + Math.random() * 0.4;
            const distancia = Math.random() * 60 + 50;
            const c = criar("div", { class: "estouro", text: sorteio(simbolos) });
            c.style.left = x + "px";
            c.style.top = y + "px";
            c.style.color = sorteio(cores);
            c.style.fontSize = (Math.random() * 12 + 14) + "px";
            c.style.setProperty("--dx", Math.cos(angulo) * distancia + "px");
            c.style.setProperty("--dy", Math.sin(angulo) * distancia + "px");
            c.style.setProperty("--giro", (Math.random() * 90 - 45) + "deg");
            document.body.append(c);
            setTimeout(() => c.remove(), 1000);
        }
    }

    function estourarNoElemento(el) {
        const r = el.getBoundingClientRect();
        estourar(r.left + r.width / 2, r.top + r.height / 2);
    }

    document.addEventListener("pointerdown", e => {
        if (e.target.closest("button, a, iframe, input, textarea, label, select, summary, .modal, .slider-container")) return;
        estourar(e.clientX, e.clientY);
    });

    function montarFundo() {
        const fundo = $("#fundo");
        for (let i = 0; i < 70; i++) {
            const estrela = criar("span", { class: "estrela" });
            estrela.style.left = Math.random() * 100 + "%";
            estrela.style.top = Math.random() * 100 + "%";
            estrela.style.animationDuration = (Math.random() * 3 + 2) + "s";
            estrela.style.animationDelay = (-Math.random() * 5) + "s";
            if (Math.random() < 0.2) estrela.style.width = estrela.style.height = "3px";
            fundo.append(estrela);
        }

        const quantidade = window.innerWidth < 600 ? 8 : 14;
        for (let i = 0; i < quantidade; i++) {
            const flor = criar("img", {
                class: "flor",
                alt: "",
                src: "https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/512/emoji_u1f33a.png",
            });
            flor.style.left = Math.random() * 95 + "vw";
            flor.style.top = Math.random() * 95 + "vh";
            flor.style.width = (Math.random() * 50 + 35) + "px";
            flor.style.setProperty("--r", (Math.random() * 360) + "deg");
            flor.style.animationDuration = (Math.random() * 4 + 5) + "s";
            flor.style.animationDelay = (-Math.random() * 5) + "s";
            flor.addEventListener("error", () => flor.remove());
            fundo.append(flor);
        }
    }

    /* =====================================================================
       INÍCIO
       ===================================================================== */
    montarFundo();
    aplicar();
    setInterval(atualizarContador, 1000);
    if (!reduzirMovimento) setInterval(criarCoracao, 450);

    carregarFotosLocais().then(() => {
        if (fotosLocais.length) montarFotos();
    });

    window.addEventListener("hashchange", () => {
        if (!/[#&]c=/.test(location.hash)) return;
        ({ cfg, origem } = carregarConfig());
        aplicar();
    });
})();
