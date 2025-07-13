// public/js/profil.js

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
  await fetch("/api/logout", {
    method: "POST",               // ← OBLIGATOIRE 🔧
    credentials: "include"        // ← Pour que le cookie soit transmis
  });
  window.location.href = "login.html";
});


  // 🔐 Vérification session
  const sessionRes  = await fetch(`${baseUrl}/api/get-session`, { credentials: "include" });
  const sessionData = await sessionRes.json();
  if (sessionData.status !== "success" || !sessionData.user) {
    return window.location.href = "login.html";
  }

  const user = sessionData.user;
  usernameEl.textContent = user.username;
  emailEl.textContent    = user.email;

  // 📥 Chargement des données
  await loadUserMusics();
  await loadUserFavorites();

  // 🗑 ConfirmBox logique
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
        : `${baseUrl}/api/music/delete`;

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
});


// ————————————————————————————————
// 🎶 Musiques uploadées
async function loadUserMusics() {
  const res  = await fetch(`${baseUrl}/api/musics`, { credentials: "include" });
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
      <span class="listenCount">🎧 Écoutes : ${music.listenCount||0}</span><br>
      📥 Téléchargements : ${music.downloadCount||0}<br>
      <a class="download-link" href="${music.path}" download>📥 Télécharger</a><br>
      <button class="deleteBtn" data-id="${music._id}">🗑 Supprimer</button>
      <hr>
    `;
    list.appendChild(li);
  });
}

document.addEventListener("click", async e => {
  if (e.target.classList.contains("deleteBtn")) {
    const id = e.target.dataset.id;

    const confirmDelete = confirm("⚠️ Confirmer la suppression de cette musique ?");
    if (!confirmDelete) return;

    try {
      const res = await fetch("/api/music/delete", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });

      const json = await res.json();
      console.log("Suppression :", json);

      if (json.status === "success") {
        alert("✅ Musique supprimée !");
        e.target.closest("li")?.remove();  // Retire l’élément visuellement
      } else {
        alert("❌ " + json.message);
      }

    } catch (err) {
      console.error("Erreur suppression :", err);
      alert("❌ Erreur serveur.");
    }
  }
});

// ————————————————————————————————
// 💙 Favoris
async function loadUserFavorites() {
  const res  = await fetch(`${baseUrl}/api/favorites`, { credentials: "include" });
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
      <span class="listenCount">🎧 Écoutes : ${music.listenCount||0}</span><br>
      📥 Téléchargements : ${music.downloadCount||0}<br>
      <a class="download-link" href="${music.path}" download>📥 Télécharger</a><br>
      <button class="removeFavBtn" data-id="${music._id}">❌ Retirer des favoris</button>
      <hr>
    `;
    list.appendChild(li);
  });
}
