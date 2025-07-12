document.addEventListener("DOMContentLoaded", () => {
  const baseUrl = ""; // ← Si tes routes sont relatives, laisse vide

  async function loadUserFavorites() {
    const res = await fetch(`${baseUrl}/api/favorites`, { credentials: "include" });
    const data = await res.json();
    const list = document.getElementById("userFavorites");
    list.innerHTML = "";

    if (!data.favorites || data.favorites.length === 0) {
      list.innerHTML = "<li style='text-align:center; color:#999;'>Aucune musique en favoris 💙</li>";
      return;
    }

    data.favorites.forEach((music) => {
      const li = document.createElement("li");
      li.className = "music-card";
      li.innerHTML = `
        <strong>${music.title}</strong> (${music.category})<br>
        <img src="${music.cover}" alt="Couverture" width="100" /><br>
        <audio controls controlsList="nodownload" src="${music.path}" style="width:100%; margin:10px 0;"></audio><br>
        <span class="listenCount">🎧 Écoutes : ${music.listenCount || 0}</span><br>
        📥 Téléchargements : ${music.downloadCount || 0}<br>
        <a class="download-link" href="${music.path}" download>📥 Télécharger</a><br>
        <button class="removeFavBtn" data-id="${music._id}">❌ Retirer des favoris</button>
        <hr>
      `;
      list.appendChild(li);

      const removeBtn = li.querySelector(".removeFavBtn");
      removeBtn.addEventListener("click", () => {
        fetch(`${baseUrl}/api/favorites/remove`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ musicId: removeBtn.dataset.id })
        })
          .then(res => res.json())
          .then(data => {
            if (data.status === "success") li.remove();
            else alert("Erreur : " + data.message);
          });
      });
    });
  }

  async function loadUserUploads() {
    const res = await fetch(`${baseUrl}/api/uploads`, { credentials: "include" });
    const data = await res.json();
    const list = document.getElementById("userUploads");
    list.innerHTML = "";

    if (!data.uploads || data.uploads.length === 0) {
      list.innerHTML = "<li style='text-align:center; color:#999;'>Aucun fichier uploadé 📤</li>";
      return;
    }

    data.uploads.forEach((music) => {
      const li = document.createElement("li");
      li.className = "music-card";
      li.innerHTML = `
        <strong>${music.title}</strong> (${music.category})<br>
        <img src="${music.cover}" alt="Couverture" width="100" /><br>
        <audio controls controlsList="nodownload" src="${music.path}" style="width:100%; margin:10px 0;"></audio><br>
        <button class="deleteUploadBtn" data-id="${music._id}">🗑 Supprimer le fichier</button>
        <hr>
      `;
      list.appendChild(li);

      const deleteBtn = li.querySelector(".deleteUploadBtn");
      deleteBtn.addEventListener("click", () => {
        const confirmBox = document.getElementById("confirmBox");
        confirmBox.style.display = "block";

        document.getElementById("confirmNo").onclick = () => {
          confirmBox.style.display = "none";
        };

        document.getElementById("confirmYes").onclick = () => {
          fetch(`${baseUrl}/api/music/delete`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ musicId: deleteBtn.dataset.id })
          })
            .then(res => res.json())
            .then(data => {
              if (data.status === "success") li.remove();
              else alert("Erreur : " + data.message);
              confirmBox.style.display = "none";
            })
            .catch(err => {
              console.error("❌ Erreur suppression :", err);
              confirmBox.style.display = "none";
            });
        };
      });
    });
  }

  // Charge les deux listes au démarrage
  loadUserFavorites();
  loadUserUploads();
});
