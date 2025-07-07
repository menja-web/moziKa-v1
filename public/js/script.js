document.addEventListener("DOMContentLoaded", () => {
  const uploadForm = document.getElementById("uploadForm");
  const musicList = document.getElementById("musicList");
  const message = document.getElementById("message");

  // Gérer l'upload
  if (uploadForm) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const formData = new FormData(uploadForm);

      message.textContent = "Envoi en cours...";

      try {
        const res = await fetch("/upload", {
          method: "POST",
          body: formData
        });

        const result = await res.json();
        if (result.success) {
          message.textContent = "🎉 Musique ajoutée avec succès !";
          uploadForm.reset();
          loadMusics(); // recharge la liste
        } else {
          message.textContent = "❌ Erreur : " + result.message;
        }
      } catch (err) {
        console.error(err);
        message.textContent = "❌ Erreur lors de l’envoi.";
      }
    });
  }

  // Charger les musiques existantes
  async function loadMusics() {
    if (!musicList) return;
    musicList.innerHTML = "Chargement...";

    try {
      const res = await fetch("/musics");
      const data = await res.json();

      if (data.success && data.musics.length > 0) {
        musicList.innerHTML = "";
        data.musics.forEach((music) => {
          const li = document.createElement("li");
          li.innerHTML = `
            <strong>${music.title}</strong> — <em>${music.uploader_email}</em><br/>
            <audio controls src="${music.url}"></audio>
            <a href="${music.url}" download>Télécharger</a>
            <hr/>
          `;
          musicList.appendChild(li);
        });
      } else {
        musicList.innerHTML = "<li>Aucune musique disponible pour l’instant.</li>";
      }
    } catch (err) {
      console.error(err);
      musicList.innerHTML = "<li>Erreur de chargement des musiques.</li>";
    }
  }

  loadMusics(); // au chargement
});
