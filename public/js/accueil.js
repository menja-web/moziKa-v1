const baseUrl = "";

document.addEventListener("DOMContentLoaded", async () => {
  const logoutLink    = document.getElementById("logoutLink");
  const usernameEl    = document.getElementById("username");
  const emailEl       = document.getElementById("email");
  const musicsList    = document.getElementById("userMusics");
  const favsList      = document.getElementById("userFavorites");
  const confirmBox    = document.getElementById("confirmBox");
  const deleteMsg     = document.getElementById("deleteMessage");

  let targetId     = "";
  let targetCard   = null;
  let isFavRemoval = false;

  // 🔐 Déconnexion
logoutLink.addEventListener("click", async e => {
  e.preventDefault();
- await fetch(`${baseUrl}/api/logout`, { credentials: "include" });
+ await fetch(`${baseUrl}/api/logout`, {
+   method: "POST",
+   credentials: "include"
+ });
  window.location.href = "login.html";
});



  // 🔍 Vérification session
  const sessionRes  = await fetch(`${baseUrl}/api/get-session`, { credentials: "include" });
  const sessionData = await sessionRes.json();
  if (sessionData.status !== "success" || !sessionData.user) {
    return window.location.href = "login.html";
  }

  const user = sessionData.user;
  usernameEl.textContent = user.username;
  emailEl.textContent    = user.email;

  // 🔄 Chargement des contenus
  await loadUserMusics();
  await loadUserFavorites();

  // 🗑 Suppression ou retrait de favori avec confirmation
  document.addEventListener("click", e => {
    if (e.target.matches(".deleteBtn, .removeFavBtn")) {
      targetId     = e.target.dataset.id;
      targetCard   = e.target.closest(".music-card");
      isFavRemoval = e.target.classList.contains("removeFavBtn");
      confirmBox.style.display = "block";
    }

    if (e.target.classList.contains("no")) {
      confirmBox.style.display = "none";
    }

    if (e.target.classList.contains("yes")) {
      const endpoint = isFavRemoval
        ? `${baseUrl}/api/remove-favorite`
        : `${baseUrl}/api/delete`;

      fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: targetId })
      })
      .then(r => r.json())
      .then(d => {
        confirmBox.style.display = "none";
        if (d.status === "success") {
          targetCard.remove();
          deleteMsg.textContent = isFavRemoval
            ? "💙 Favori retiré avec succès"
            : "✅ Supprimée avec succès";
          deleteMsg.style.display = "inline-block";
          setTimeout(() => deleteMsg.style.display = "none", 3000);
          if (isFavRemoval) loadUserFavorites();
        } else {
          alert("Erreur : " + d.message);
        }
      })
      .catch(() => {
        deleteMsg.textContent = "❌ Erreur serveur";
        deleteMsg.style.display = "inline-block";
        confirmBox.style.display = "none";
      });
    }
  });

  // 💙 Ajouter un favori
  document.addEventListener("click", e => {
    if (e.target.classList.contains("addFavBtn")) {
      const musicId = e.target.dataset.id;

      fetch("/api/add-favorite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: musicId })
      })
      .then(r => r.json())
      .then(d => {
        if (d.status === "success") {
          alert("💙 Ajouté aux favoris !");
          loadUserFavorites();
        } else {
          alert("Erreur ajout favori : " + d.message);
        }
      })
      .catch(() => alert("❌ Erreur serveur"));
    }
  });
});

// 🎵 Musiques uploadées
async function loadUserMusics() {
  const res  = await fetch(`/api/musics`, { credentials: "include" });
  const data = await res.json();
  const list = document.getElementById("userMusics");
  list.innerHTML = "";

  const uploads = (data.musics || []).filter(m => m.uploader === document.getElementById("username").textContent);
  if (uploads.length === 0) {
    list.innerHTML = `<li style="text-align:center;color:#999;">Aucune musique uploadée 🎶</li>`;
    return;
  }

  uploads.forEach(music => {
    const li = document.createElement("li");
    li.className = "music-card";
    li.dataset.id = music._id;
    li.innerHTML = `
      <strong>${music.title}</strong> (${music.category})<br>
      <img src="${music.cover}" alt="Couverture" width="100"/><br>
      <audio controls controlsList="nodownload" src="${music.path}" style="width:100%;margin:10px 0;"></audio><br>
      🎧 Écoutes : ${music.listenCount || 0}<br>
      📥 Téléchargements : ${music.downloadCount || 0}<br>
      <a class="download-link" href="${music.path}" download>📥 Télécharger</a><br>
      <button class="deleteBtn" data-id="${music._id}">🗑 Supprimer</button>
      <button class="addFavBtn" data-id="${music._id}">💙 Ajouter aux favoris</button>
      <button class="shareBtn" data-url="https://mozika-gasy.onrender.com/music/${music._id}">🔗 Partager</button>
      <span class="shareMessage hidden">📋 Lien copié !</span>
      <hr>
    `;
    list.appendChild(li);
  });
}
  // 🔗 Partage de lien
  document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("shareBtn")) {
      const musicId = e.target.dataset.id;
      const url = `${window.location.origin}/music/${musicId}`;

      try {
        await navigator.clipboard.writeText(url);

        const msg = document.createElement("span");
        msg.textContent = "📋 Lien copié !";
        msg.className = "shareMessage";
        e.target.insertAdjacentElement("afterend", msg);

        setTimeout(() => msg.remove(), 2000);
      } catch (err) {
        alert("❌ Impossible de copier le lien.");
        console.error("Erreur partage :", err);
      }
    }
  });

// 💙 Favoris
async function loadUserFavorites() {
  const res  = await fetch(`/api/favorites`, { credentials: "include" });
  const data = await res.json();
  const list = document.getElementById("userFavorites");
  list.innerHTML = "";

  if (!data.favorites || data.favorites.length === 0) {
    list.innerHTML = `<li style="text-align:center;color:#999;">Aucune musique en favoris 💙</li>`;
    return;
  }

  data.favorites.forEach(music => {
    const li = document.createElement("li");
    li.className = "music-card";
    li.dataset.id = music._id;
    li.innerHTML = `
      <strong>${music.title}</strong> (${music.category})<br>
      <img src="${music.cover}" alt="Couverture" width="100"/><br>
      <audio controls controlsList="nodownload" src="${music.path}" style="width:100%;margin:10px 0;"></audio><br>
      🎧 Écoutes : ${music.listenCount || 0}<br>
      📥 Téléchargements : ${music.downloadCount || 0}<br>
      <a class="download-link" href="${music.path}" download>📥 Télécharger</a><br>
      <button class="shareBtn" data-id="${music._id}">🔗 Partager</button>
      <button class="removeFavBtn" data-id="${music._id}">❌ Retirer des favoris</button>
      <button class="shareBtn" data-url="https://mozika-gasy.onrender.com/music/${music._id}">🔗 Partager</button>
      <span class="shareMessage hidden">📋 Lien copié !</span>
      <hr>
    `;
    list.appendChild(li);
  });
}
