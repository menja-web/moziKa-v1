document.addEventListener("DOMContentLoaded", () => {
  // 🔄 Charger les favoris depuis l'API
  fetch("/api/favorites", {
    method: "GET",
    credentials: "include"
  })
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        console.log("🎧 Favoris :", data.favorites);
        // 💡 Tu peux ici surligner les musiques déjà en favoris
      } else {
        console.warn("⚠️ Utilisateur non connecté ou favoris introuvables :", data.message);
      }
    })
    .catch(err => console.error("❌ Erreur récupération favoris :", err));

  // ❤️ Gestion des clics "ajouter aux favoris"
  const allButtons = document.querySelectorAll(".btn-fav");

  allButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const musicId = btn.dataset.musicId;

      // ✅ Vérification avant requête
      if (!musicId) {
        console.warn("❌ musicId manquant, requête ignorée");
        return;
      }

      fetch("/api/favorites/add", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ musicId })
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === "success") {
            console.log("✅ Ajouté aux favoris :", musicId);
            btn.classList.add("active");
          } else {
            console.warn("❌ Erreur ajout favoris :", data.message);
          }
        })
        .catch(err => console.error("💥 Requête échouée :", err));
    });
  });
});
