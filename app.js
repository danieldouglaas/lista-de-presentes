(() => {
  const STORAGE_KEY = "natal_familia_wishlist_v1";
  const AVATAR_COLORS = ["#1b4332", "#b91c1c", "#b45309", "#0f766e", "#7c2d12", "#4338ca"];

  const config = window.APP_CONFIG || {};
  const googleScriptUrl = (config.googleScriptUrl || "").trim();
  const hasGoogleSheets = Boolean(googleScriptUrl);
  const hasSupabase =
    !hasGoogleSheets &&
    Boolean(config.supabaseUrl && config.supabaseUrl.trim()) &&
    Boolean(config.supabaseAnonKey && config.supabaseAnonKey.trim()) &&
    typeof window.supabase !== "undefined";

  const supabaseClient = hasSupabase
    ? window.supabase.createClient(config.supabaseUrl.trim(), config.supabaseAnonKey.trim())
    : null;

  // Elementos da página
  const el = {
    title: document.getElementById("app-title"),
    subtitle: document.getElementById("app-subtitle"),
    priceHint: document.getElementById("app-price-hint"),
    demoBanner: document.getElementById("demo-banner"),
    dismissDemo: document.getElementById("btn-dismiss-demo"),
    searchInput: document.getElementById("search-input"),
    participantCount: document.getElementById("participant-count"),
    loadingState: document.getElementById("loading-state"),
    emptyState: document.getElementById("empty-state"),
    emptyMessage: document.getElementById("empty-message"),
    grid: document.getElementById("wishlist-grid"),

    btnOpenAdd: document.getElementById("btn-open-add"),
    btnShareLink: document.getElementById("btn-share-link"),

    entryModal: document.getElementById("entry-modal"),
    modalTitle: document.getElementById("modal-title"),
    btnCloseModal: document.getElementById("btn-close-modal"),
    btnCancelModal: document.getElementById("btn-cancel-modal"),
    entryForm: document.getElementById("entry-form"),
    entryId: document.getElementById("entry-id"),
    inputName: document.getElementById("input-name"),
    inputSizeShirt: document.getElementById("input-size-shirt"),
    inputSizePants: document.getElementById("input-size-pants"),
    inputSizeShoe: document.getElementById("input-size-shoe"),
    giftRows: document.getElementById("gift-rows"),
    btnAddGiftRow: document.getElementById("btn-add-gift-row"),
    inputAvoid: document.getElementById("input-avoid"),
    inputPin: document.getElementById("input-pin"),
    btnDeleteEntry: document.getElementById("btn-delete-entry"),
    btnSaveEntry: document.getElementById("btn-save-entry"),

    pinModal: document.getElementById("pin-modal"),
    btnClosePin: document.getElementById("btn-close-pin"),
    btnCancelPin: document.getElementById("btn-cancel-pin"),
    pinForm: document.getElementById("pin-form"),
    pinVerifyInput: document.getElementById("pin-verify-input"),
    pinError: document.getElementById("pin-error"),

    toast: document.getElementById("toast"),
  };

  let entries = [];
  let pendingPinEntryId = null;
  let toastTimer = null;

  // Dados iniciais apenas para o modo demonstração local
  const DEMO_SEED = [
    {
      id: "demo-1",
      name: "Tia Maria (Exemplo)",
      sizes: "Blusa M · Sandália 37",
      wishes: [
        { title: "Livro de receitas ou romance policial", link: "" },
        { title: "Caneca térmica para café", link: "" },
        { title: "Vale-presente da Livraria Cultura", link: "" },
      ],
      avoid: "Perfumes muito doces",
      pin: "",
      updated_at: new Date().toISOString(),
    },
    {
      id: "demo-2",
      name: "João Pedro (Exemplo)",
      sizes: "Camiseta G · Tênis 41",
      wishes: [
        { title: "Camiseta básica preta ou verde", link: "" },
        { title: "Fone de ouvido sem fio", link: "" },
      ],
      avoid: "Roupas com estampa grande",
      pin: "",
      updated_at: new Date().toISOString(),
    },
  ];

  function applyConfigTexts() {
    if (config.familyTitle) {
      el.title.textContent = config.familyTitle;
      document.title = config.familyTitle;
    }
    if (config.subtitle) {
      el.subtitle.textContent = config.subtitle;
    }
    if (config.priceHint && config.priceHint.trim()) {
      el.priceHint.textContent = config.priceHint.trim();
      el.priceHint.classList.remove("hidden");
    }
    if (!hasGoogleSheets && !hasSupabase) {
      el.demoBanner.classList.remove("hidden");
    }
  }

  function showToast(message) {
    el.toast.textContent = message;
    el.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.classList.add("hidden");
    }, 3200);
  }

  function getInitials(name) {
    const cleaned = (name || "").replace(/\([^)]*\)/g, "").trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  function sanitizeHttpUrl(rawUrl) {
    const trimmed = (rawUrl || "").trim();
    if (!trimmed) return "";
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }
    } catch {
      return "";
    }
    return "";
  }

  function formatDate(isoString) {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  async function callGoogleScript(payload) {
    const response = await fetch(googleScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!data || !data.ok) {
      throw new Error((data && data.error) || "Erro no Google Apps Script");
    }
    return data;
  }

  // Persistência
  async function loadEntries() {
    el.loadingState.classList.remove("hidden");
    el.grid.innerHTML = "";
    el.emptyState.classList.add("hidden");

    try {
      if (hasGoogleSheets) {
        const response = await fetch(googleScriptUrl);
        const data = await response.json();
        if (!data || !data.ok) {
          throw new Error((data && data.error) || "Erro ao ler planilha");
        }
        entries = Array.isArray(data.entries) ? data.entries : [];
      } else if (supabaseClient) {
        const { data, error } = await supabaseClient
          .from("wishlist_entries")
          .select("*")
          .order("name", { ascending: true });

        if (error) throw error;
        entries = Array.isArray(data) ? data : [];
      } else {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          entries = JSON.parse(raw);
        } else {
          entries = [...DEMO_SEED];
          localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
        }
      }
    } catch (err) {
      console.error("Erro ao carregar listas:", err);
      showToast("Não foi possível carregar as listas. Verifique a conexão.");
      entries = [];
    } finally {
      el.loadingState.classList.add("hidden");
      renderEntries();
    }
  }

  function saveLocalEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  async function upsertEntry(payload, existingId) {
    if (hasGoogleSheets) {
      const data = await callGoogleScript({
        action: "upsert",
        entry: { id: existingId || "", ...payload },
      });
      const saved = data.entry;
      if (existingId) {
        const idx = entries.findIndex((item) => item.id === existingId);
        if (idx >= 0) entries[idx] = saved;
      } else {
        entries.push(saved);
      }
    } else if (supabaseClient) {
      if (existingId) {
        const { data, error } = await supabaseClient
          .from("wishlist_entries")
          .update(payload)
          .eq("id", existingId)
          .select()
          .single();
        if (error) throw error;
        const idx = entries.findIndex((item) => item.id === existingId);
        if (idx >= 0) entries[idx] = data;
      } else {
        const { data, error } = await supabaseClient
          .from("wishlist_entries")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        entries.push(data);
      }
    } else {
      const now = new Date().toISOString();
      if (existingId) {
        const idx = entries.findIndex((item) => item.id === existingId);
        if (idx >= 0) {
          entries[idx] = { ...entries[idx], ...payload, updated_at: now };
        }
      } else {
        entries.push({
          id: "local-" + Date.now(),
          ...payload,
          updated_at: now,
        });
      }
      saveLocalEntries();
    }

    entries.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    renderEntries();
  }

  async function deleteEntry(id) {
    if (hasGoogleSheets) {
      await callGoogleScript({ action: "delete", id });
    } else if (supabaseClient) {
      const { error } = await supabaseClient.from("wishlist_entries").delete().eq("id", id);
      if (error) throw error;
    }
    entries = entries.filter((item) => item.id !== id);
    if (!hasGoogleSheets && !supabaseClient) {
      saveLocalEntries();
    }
    renderEntries();
  }

  // Renderização
  function renderEntries() {
    const query = (el.searchInput.value || "").trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (!query) return true;
      const wishesText = (entry.wishes || []).map((w) => w.title).join(" ");
      const haystack = `${entry.name} ${entry.sizes || ""} ${wishesText} ${entry.avoid || ""}`.toLowerCase();
      return haystack.includes(query);
    });

    el.participantCount.textContent = String(entries.length);
    el.grid.innerHTML = "";

    if (filtered.length === 0) {
      el.emptyState.classList.remove("hidden");
      el.emptyMessage.textContent = query
        ? `Nenhuma lista encontrada para "${el.searchInput.value.trim()}".`
        : "Seja a primeira pessoa da família a colocar suas ideias de presentes!";
      return;
    }

    el.emptyState.classList.add("hidden");

    const fragment = document.createDocumentFragment();
    for (const entry of filtered) {
      fragment.appendChild(createMemberCard(entry));
    }
    el.grid.appendChild(fragment);
  }

  function createMemberCard(entry) {
    const card = document.createElement("article");
    card.className = "member-card";

    // Header
    const header = document.createElement("div");
    header.className = "card-header";

    const personInfo = document.createElement("div");
    personInfo.className = "person-info";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.style.backgroundColor = getAvatarColor(entry.name);
    avatar.textContent = getInitials(entry.name);

    const nameWrap = document.createElement("div");
    nameWrap.style.minWidth = "0";

    const nameEl = document.createElement("h2");
    nameEl.className = "person-name";
    nameEl.textContent = entry.name;
    nameEl.title = entry.name;

    const updatedEl = document.createElement("div");
    updatedEl.className = "updated-at";
    const dateLabel = formatDate(entry.updated_at);
    updatedEl.textContent = dateLabel ? `Atualizado em ${dateLabel}` : "Lista cadastrada";

    nameWrap.append(nameEl, updatedEl);
    personInfo.append(avatar, nameWrap);

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "edit-btn";
    editBtn.textContent = entry.pin ? "🔒 Editar" : "Editar";
    editBtn.addEventListener("click", () => handleEditClick(entry));

    header.append(personInfo, editBtn);
    card.appendChild(header);

    // Tamanhos
    if (entry.sizes && entry.sizes.trim()) {
      const sizesBadge = document.createElement("div");
      sizesBadge.className = "sizes-badge";
      sizesBadge.textContent = `👕 ${entry.sizes.trim()}`;
      card.appendChild(sizesBadge);
    }

    // Lista de desejos
    const wishesSection = document.createElement("div");
    wishesSection.className = "wishes-section";

    const wishesTitle = document.createElement("h3");
    wishesTitle.textContent = "Ideias de presentes";

    const wishesList = document.createElement("ul");
    wishesList.className = "wishes-list";

    const wishes = Array.isArray(entry.wishes) ? entry.wishes : [];
    for (const wish of wishes) {
      if (!wish || !wish.title) continue;
      const li = document.createElement("li");
      li.className = "wish-item";

      const span = document.createElement("span");
      span.textContent = `🎁 ${wish.title}`;
      li.appendChild(span);

      const safeUrl = sanitizeHttpUrl(wish.link);
      if (safeUrl) {
        const a = document.createElement("a");
        a.className = "wish-link";
        a.href = safeUrl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Ver referência / link ↗";
        li.appendChild(a);
      }

      wishesList.appendChild(li);
    }

    wishesSection.append(wishesTitle, wishesList);
    card.appendChild(wishesSection);

    // O que evitar
    if (entry.avoid && entry.avoid.trim()) {
      const avoidBox = document.createElement("div");
      avoidBox.className = "avoid-box";
      avoidBox.textContent = `🚫 Evitar: ${entry.avoid.trim()}`;
      card.appendChild(avoidBox);
    }

    return card;
  }

  // Modal de Presentes (Adicionar / Editar)
  function createGiftRow(title = "", link = "") {
    const row = document.createElement("div");
    row.className = "gift-row";

    const top = document.createElement("div");
    top.className = "gift-row-top";

    const titleInput = document.createElement("input");
    titleInput.type = "text";
    titleInput.className = "gift-title-input";
    titleInput.placeholder = "Ex: Perfume amadeirado, Livro, Camisa polo...";
    titleInput.maxLength = 120;
    titleInput.value = title;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "remove-gift-btn";
    removeBtn.title = "Remover item";
    removeBtn.textContent = "✕";
    removeBtn.addEventListener("click", () => {
      if (el.giftRows.children.length > 1) {
        row.remove();
      } else {
        titleInput.value = "";
        urlInput.value = "";
      }
    });

    top.append(titleInput, removeBtn);

    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.className = "gift-url-input";
    urlInput.placeholder = "Cole aqui o endereço da loja (se quiser)";
    urlInput.maxLength = 350;
    urlInput.value = link;

    const hasLink = Boolean((link || "").trim());
    if (!hasLink) {
      urlInput.classList.add("hidden");
    }

    const addLinkBtn = document.createElement("button");
    addLinkBtn.type = "button";
    addLinkBtn.className = "btn-link gift-link-toggle";
    addLinkBtn.textContent = "+ Colocar link da loja";
    if (hasLink) {
      addLinkBtn.classList.add("hidden");
    }
    addLinkBtn.addEventListener("click", () => {
      urlInput.classList.remove("hidden");
      addLinkBtn.classList.add("hidden");
      urlInput.focus();
    });

    row.append(top, addLinkBtn, urlInput);
    return row;
  }

  function formatSizesFromInputs() {
    const parts = [];
    const shirt = el.inputSizeShirt.value.trim();
    const pants = el.inputSizePants.value.trim();
    const shoe = el.inputSizeShoe.value.trim();
    if (shirt) parts.push(`Camisa ${shirt}`);
    if (pants) parts.push(`Calça/Bermuda ${pants}`);
    if (shoe) parts.push(`Calçado ${shoe}`);
    return parts.join(", ");
  }

  function populateSizeInputs(sizesText) {
    el.inputSizeShirt.value = "";
    el.inputSizePants.value = "";
    el.inputSizeShoe.value = "";
    if (!sizesText) return;

    const segments = sizesText.split(/[,·]/).map((s) => s.trim()).filter(Boolean);
    for (const seg of segments) {
      if (/^(camisa|camiseta|blusa)\s+/i.test(seg)) {
        el.inputSizeShirt.value = seg.replace(/^(camisa|camiseta|blusa)\s+/i, "").trim();
      } else if (/^(cal[çc]a\/bermuda|cal[çc]a|bermuda|short)\s+/i.test(seg)) {
        el.inputSizePants.value = seg.replace(/^(cal[çc]a\/bermuda|cal[çc]a|bermuda|short)\s+/i, "").trim();
      } else if (/^(cal[çc]ado|t[êe]nis|sapato|sand[áa]lia)\s+/i.test(seg)) {
        el.inputSizeShoe.value = seg.replace(/^(cal[çc]ado|t[êe]nis|sapato|sand[áa]lia)\s+/i, "").trim();
      }
    }
  }

  function openEntryModal(entry = null) {
    el.entryForm.reset();
    el.giftRows.innerHTML = "";

    if (entry) {
      el.modalTitle.textContent = `Editar lista de ${entry.name}`;
      el.entryId.value = entry.id;
      el.inputName.value = entry.name || "";
      populateSizeInputs(entry.sizes || "");
      el.inputAvoid.value = entry.avoid || "";
      el.inputPin.value = entry.pin || "";
      el.btnDeleteEntry.classList.remove("hidden");

      const wishes = Array.isArray(entry.wishes) && entry.wishes.length > 0 ? entry.wishes : [{ title: "", link: "" }];
      for (const wish of wishes) {
        el.giftRows.appendChild(createGiftRow(wish.title || "", wish.link || ""));
      }
    } else {
      el.modalTitle.textContent = "Adicionar minha lista de presentes";
      el.entryId.value = "";
      el.btnDeleteEntry.classList.add("hidden");
      el.giftRows.appendChild(createGiftRow());
      el.giftRows.appendChild(createGiftRow());
    }

    el.entryModal.classList.remove("hidden");
    el.inputName.focus();
  }

  function closeEntryModal() {
    el.entryModal.classList.add("hidden");
  }

  // Verificação de PIN
  function handleEditClick(entry) {
    if (entry.pin && entry.pin.trim()) {
      pendingPinEntryId = entry.id;
      el.pinVerifyInput.value = "";
      el.pinError.classList.add("hidden");
      el.pinModal.classList.remove("hidden");
      el.pinVerifyInput.focus();
    } else {
      openEntryModal(entry);
    }
  }

  function closePinModal() {
    pendingPinEntryId = null;
    el.pinModal.classList.add("hidden");
  }

  // Eventos
  el.dismissDemo.addEventListener("click", () => {
    el.demoBanner.classList.add("hidden");
  });

  el.searchInput.addEventListener("input", renderEntries);

  el.btnOpenAdd.addEventListener("click", () => openEntryModal(null));
  el.btnCloseModal.addEventListener("click", closeEntryModal);
  el.btnCancelModal.addEventListener("click", closeEntryModal);

  el.btnAddGiftRow.addEventListener("click", () => {
    const row = createGiftRow();
    el.giftRows.appendChild(row);
    row.querySelector(".gift-title-input").focus();
  });

  el.entryForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = el.inputName.value.trim();
    const sizes = formatSizesFromInputs();
    const avoid = el.inputAvoid.value.trim();
    const pin = el.inputPin.value.trim();

    if (pin && !/^\d{4}$/.test(pin)) {
      showToast("A senha deve ter exatamente 4 números.");
      el.inputPin.focus();
      return;
    }

    const wishes = [];
    for (const row of el.giftRows.querySelectorAll(".gift-row")) {
      const title = row.querySelector(".gift-title-input").value.trim();
      const rawLink = row.querySelector(".gift-url-input").value.trim();
      if (title) {
        wishes.push({
          title,
          link: sanitizeHttpUrl(rawLink),
        });
      }
    }

    if (!name || wishes.length === 0) {
      showToast("Preencha seu nome e pelo menos 1 ideia de presente.");
      return;
    }

    el.btnSaveEntry.disabled = true;
    el.btnSaveEntry.textContent = "Salvando...";

    try {
      const existingId = el.entryId.value || null;
      await upsertEntry(
        {
          name,
          sizes,
          wishes,
          avoid,
          pin,
          updated_at: new Date().toISOString(),
        },
        existingId
      );
      closeEntryModal();
      showToast(existingId ? "Lista atualizada! 🎄" : "Lista adicionada com sucesso! 🎁");
    } catch (err) {
      console.error("Erro ao salvar:", err);
      showToast("Erro ao salvar lista. Tente novamente.");
    } finally {
      el.btnSaveEntry.disabled = false;
      el.btnSaveEntry.textContent = "Salvar lista";
    }
  });

  el.btnDeleteEntry.addEventListener("click", async () => {
    const existingId = el.entryId.value;
    if (!existingId) return;
    if (!window.confirm("Tem certeza que deseja excluir esta lista de presentes?")) return;

    try {
      await deleteEntry(existingId);
      closeEntryModal();
      showToast("Lista removida.");
    } catch (err) {
      console.error("Erro ao excluir:", err);
      showToast("Não foi possível excluir a lista.");
    }
  });

  el.btnClosePin.addEventListener("click", closePinModal);
  el.btnCancelPin.addEventListener("click", closePinModal);

  el.pinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const entry = entries.find((item) => item.id === pendingPinEntryId);
    if (!entry) {
      closePinModal();
      return;
    }
    if (el.pinVerifyInput.value.trim() === entry.pin) {
      closePinModal();
      openEntryModal(entry);
    } else {
      el.pinError.classList.remove("hidden");
      el.pinVerifyInput.select();
    }
  });

  el.btnShareLink.addEventListener("click", async () => {
    const url = window.location.href;
    const shareText = `🎄 Pessoal, coloquei aqui o link do nosso Mural de Presentes do Amigo Oculto! Entrem para colocar suas preferências: ${url}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: el.title.textContent,
          text: "Entrem para colocar suas preferências de presentes do Amigo Oculto!",
          url,
        });
        return;
      } catch {
        // Fallback para copiar link
      }
    }

    try {
      await navigator.clipboard.writeText(shareText);
      showToast("Mensagem com link copiada! Cole no grupo do WhatsApp 📋");
    } catch {
      window.prompt("Copie o link abaixo para enviar no WhatsApp:", url);
    }
  });

  // Fechar modais com Escape
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeEntryModal();
      closePinModal();
    }
  });

  // Realtime do Supabase (atualiza automaticamente se outro familiar salvar)
  if (supabaseClient) {
    supabaseClient
      .channel("wishlist_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wishlist_entries" },
        () => {
          loadEntries();
        }
      )
      .subscribe();
  }

  applyConfigTexts();
  loadEntries();
})();
