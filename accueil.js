document.addEventListener("DOMContentLoaded", () => {
  // 🔄 Chargement des favoris au démarrage
  fetch("/api/favorites", {
    method: "GET",
    credentials: "include"
  })
    .then(res => res.json())
    .then(data => {
      if (data.status === "success") {
        console.log("🎧 Favoris :", data.favorites);
        // Tu peux ici mettre à jour l’UI selon les favoris
      } else {
        console.warn("🚫 Pas de favoris ou utilisateur non connecté :", data.message);
      }
    })
    .catch(err => console.error("❌ Erreur récupération favoris :", err));

  // 🖱️ Bouton "Ajouter aux favoris"
  const allButtons = document.querySelectorAll(".btn-fav");
  allButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const musicId = btn.dataset.musicId; // ⚠️ ton bouton doit avoir: data-music-id="123"
btn.addEventListener("click", () => {
  const musicId = btn.dataset.musicId;

  // ✅ Vérification AVANT d'envoyer la requête
  if (!musicId) {
    console.warn("❌ musicId non défini, requête ignorée !");
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
        console.warn("❌ Impossible d’ajouter :", data.message);
      }
    })
    .catch(err => console.error("Erreur ajout favoris :", err));
});
