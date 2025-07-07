(async () => {
  const username = new URLSearchParams(location.search).get("user");
  const errorMsg = document.getElementById("error");

  try {
    const res = await fetch("/api/createurs");
    const data = await res.json();
    const user = data.find(c => c.username === username);

    if (!user) {
      errorMsg.textContent = "❌ Créateur introuvable.";
      return;
    }

    // 🖼️ Photo de profil
    document.getElementById("photo").src = user.photo || "./faces/default.jpg";

    // 🎵 Nom + badge vérifié
    document.getElementById("username").textContent = user.username;
    document.getElementById("badge").style.display = user.verified ? "inline-block" : "none";

    // 📧 Email, CIN, Téléphone
    document.getElementById("email").textContent = "📧 Email : " + user.email;
    document.getElementById("cin").textContent = "🆔 CIN : " + user.cin;
    document.getElementById("phone").textContent = "📞 Téléphone : " + user.phone;

    // 📊 Stats
    document.getElementById("streams").textContent = user.streams;
    document.getElementById("royalties").textContent = user.royalties + " €";

    // 🖼️ Si tu veux utiliser une image de fond personnalisée :
    if (document.getElementById("banner")) {
      document.getElementById("banner").style.backgroundImage = `url('${user.photo}')`;
    }

    // ✅ Tout est OK, on cache le message d’erreur
    errorMsg.textContent = "";
  } catch (err) {
    console.error("Erreur profil-createur.js :", err);
    errorMsg.textContent = "❌ Une erreur s'est produite.";
  }
})();
