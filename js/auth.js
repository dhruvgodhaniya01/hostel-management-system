const HMS_PASSWORD = "vurhd9352";

document.addEventListener("DOMContentLoaded", () => {
    const overlay = document.createElement("div");

    overlay.id = "hms-password-overlay";

    overlay.innerHTML = `
        <div class="hms-password-box">
            <h2>Hostel Management System</h2>
            <p>Enter password to continue</p>

            <input
                type="password"
                id="hms-password-input"
                placeholder="Enter password"
                autocomplete="off"
            >

            <button id="hms-password-btn">Unlock</button>

            <p id="hms-password-error"></p>
        </div>
    `;

    document.body.appendChild(overlay);

    document.body.style.overflow = "hidden";

    const input = document.getElementById("hms-password-input");
    const button = document.getElementById("hms-password-btn");
    const error = document.getElementById("hms-password-error");

    function checkPassword() {
        if (input.value === HMS_PASSWORD) {
            overlay.remove();
            document.body.style.overflow = "";
        } else {
            error.textContent = "Incorrect password!";
            input.value = "";
            input.focus();
        }
    }

    button.addEventListener("click", checkPassword);

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            checkPassword();
        }
    });

    input.focus();
});