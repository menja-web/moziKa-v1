// accueil.js

const baseUrl = window.location.origin;

document.addEventListener("DOMContentLoaded", async () => {
  const logoutLink     = document.getElementById("logoutLink");
  const usernameEl     = document.getElementById("username");
  const emailEl        = document.getElementById("email");
  const confirmBox     = document.getElementById("confirmBox");
  const deleteMsg      = document.getElementById("deleteMessage");
 

  let targetId     = "";
  let targetCard   = null;
  let isFavRemoval = false;

  // 🔐 Déconnexion
  logoutLink.addEventListener("click", async e => {
    e.preventDefault();
    await fetch(`${baseUrl}/api/logout`, {
      method: "POST",
      credentials: "include"
    });
    window.location.href = "login.html";
  });

  // 🔍 Vérification de la session
  const sessionRes  = await fetch(`${baseUrl}/api/get-session`, { credentials: "include" });
  const sessionData = await sessionRes.json();
  if (sessionData.status !== "success" || !sessionData.user) {
    window.location.href = "login.html";
    return;
  }

  const user = sessionData.user;
  usernameEl.textContent = user.username;
  emailEl.textContent    = user.email;

  // 🔄 Chargement des listes
  await loadUserMusics();
  await loadUserFavorites();

  // 🗑 Suppression / Retrait de favori (confirmation)
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
            : "✅ Supprimé avec succès";
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

      fetch(`${baseUrl}/api/add-favorite`, {
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

  // 🔗 Copier le lien
  document.addEventListener("click", async e => {
    if (e.target.classList.contains("shareBtn")) {
      const url = e.target.dataset.url;
      const msg = e.target.nextElementSibling;

      try {
        await navigator.clipboard.writeText(url);
        msg.textContent = "📋 Lien copié !";
        msg.classList.remove("hidden");
        setTimeout(() => msg.classList.add("hidden"), 2000);
      } catch {
        msg.textContent = "❌ Erreur copie";
        msg.classList.remove("hidden");
        msg.style.color = "red";
      }
    }
  });
}); // ← FIN de DOMContentLoaded

// 🎵 Chargement des musiques uploadées
async function loadUserMusics() {
  const res  = await fetch(`${baseUrl}/api/musics`, { credentials: "include" });
  const data = await res.json();
  const list = document.getElementById("userMusics");
  list.innerHTML = "";

  const uploads = (data.musics || []).filter(
    m => m.uploader === document.getElementById("username").textContent
  );
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
      <button class="addFavBtn" data-id="${music._id}">💙 Ajouter aux favoris</button><br>
      <button class="shareBtn" data-url="${baseUrl}/share/${music._id}">🔗 Copier le lien</button>
      <span class="shareMessage hidden">📋 Lien copié !</span>
      <br><ahref="https://www.facebook.com/sharer/sharer.php?u=${baseUrl}/share/${music._id}"target="_blank" class="fbShareBtn">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
          style="vertical-align:middle;margin-right:6px;" viewBox="0 0 512 512" fill="white">
          <path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.5 90.8 225.8 209 240v-168h-63v-72h63v-55.2
          c0-62.2 37-96.8 93.7-96.8 27.1 0 55.5 4.8 55.5 4.8v61h-31.2c-30.7 0-40.3 19.1-40.3 38.7V184h68.5
          l-11 72h-57.5v168c118.2-14.2 209-116.5 209-240z"/>
        </svg>
        Partager sur Facebook
      </ahref=><br>
      <div class="counters">
        Écoute : <span class="listenCount">${music.listenCount || 0}</span> fois —
        Téléchargements : <span class="downloadCount">${music.downloadCount || 0}</span> fois
      </div>
      <hr>
    `;
    list.appendChild(li);
  });
}

// 💙 Chargement des favoris
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
      🎧 Écoutes : ${music.listenCount || 0}<br>
      📥 Téléchargements : ${music.downloadCount || 0}<br>
      <a class="download-link" href="${music.path}" download>📥 Télécharger</a><br>
      <button class="removeFavBtn" data-id="${music._id}">❌ Retirer des favoris</button><br>
      <button class="shareBtn" data-url="${baseUrl}/share/${music._id}">🔗 Copier le lien</button>
      <span class="shareMessage hidden">📋 Lien copié !</span><br>
      <a
        href="https://www.facebook.com/sharer/sharer.php?u=${baseUrl}/share/${music._id}"
        target="_blank" class="fbShareBtn"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
          style="vertical-align:middle;margin-right:6px;" viewBox="0 0 512 512" fill="white">
          <path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.5 90.8 225.8 209 240v-168h-63v-72h63v-55.2
          c0-62.2 37-96.8 93.7-96.8 27.1 0 55.5 4.8 55.5 4.8v61h-31.2c-30.7 0-40.3 19.1-40.3 38.7V184h68.5
          l-11 72h-57.5v168c118.2-14.2 209-116.5 209-240z"/>
        </svg>
        Partager sur Facebook
      </a><br>
      <div class="counters">
        Écoute : <span class="listenCount">${music.listenCount || 0}</span> fois —
        Téléchargements : <span class="downloadCount">${music.downloadCount || 0}</span> fois
      </div>
      <hr>
    `;
    list.appendChild(li);
  });
}
