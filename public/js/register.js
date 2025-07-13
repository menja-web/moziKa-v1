console.log("register.js chargé ✅");

async function registerUser(username, email, password) {
  const msg = document.getElementById("registerMessage");

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      credentials: "include",  // envoie le cookie connect.sid
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password })
    });

    // Vérifie que la réponse est du JSON
    if (!response.ok) {
      throw new Error(`Statut ${response.status}`);
    }

    const result = await response.json();
    console.log("Réponse inscription :", result);

    if (result.status === "success") {
      // Stocke en local pour usage éventuel
      localStorage.setItem("mozika_username", username);
      localStorage.setItem("userEmail", email);

      msg.style.color = "green";
      msg.textContent = "✅ Compte créé avec succès ! Redirection…";

      setTimeout(() => {
        window.location.href = "accueil.html";
      }, 1500);
    } else {
      msg.style.color = "red";
      msg.textContent = result.message || "❌ Échec de l’inscription.";
    }
  } catch (err) {
    console.error("Erreur fetch :", err);
    msg.style.color = "red";
    msg.textContent = "❌ Erreur serveur, réessaie plus tard.";
  }
}

document
  .getElementById("registerForm")
  .addEventListener("submit", function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("registerMessage");

    if (!username || !email || !password) {
      msg.style.color = "red";
      msg.textContent = "❌ Tous les champs sont obligatoires.";
      return;
    }

    registerUser(username, email, password);
  });
