console.log("✅ login.js chargé");

async function loginUser(email, password) {
  const message = document.getElementById("loginMessage");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: email.trim(),
        password: password.trim()
      })
    });

    const result = await response.json();
    console.log("🔐 Réponse serveur :", result);

    if (result.status === "success") {
      // 🧼 Nettoie les anciennes données
      localStorage.removeItem("mozika_username");
      localStorage.removeItem("userEmail");

      // ✅ Enregistre les nouvelles infos
      localStorage.setItem("mozika_username", result.username || "Utilisateur");
      localStorage.setItem("userEmail", result.email);

      // ✅ Message dans la page
      message.textContent = "✅ Connexion réussie ! Redirection...";
      message.style.color = "green";

      // 🕐 Redirection vers dashboard.html
      setTimeout(() => {
        window.location.href = "dashboard.html";
      }, 1500);
    } else {
      // ❌ Identifiants incorrects
      message.textContent = "❌ " + result.message;
      message.style.color = "red";
    }
  } catch (error) {
    console.error("❌ Erreur de connexion :", error);
    message.textContent = "❌ Erreur serveur. Réessaie plus tard.";
    message.style.color = "red";
  }
}

// 📩 Gestion du formulaire
document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  loginUser(email, password);
});
