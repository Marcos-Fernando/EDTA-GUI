// =========== Finding results ============
async function atualizarStatus() {
  const res = await fetch("/status");
  const dados = await res.json();

  const ul = document.getElementById("list-results");

  // Saves the IDs of the logs that are expanded
  const logsAbertos = new Set();
  ul.querySelectorAll("li").forEach(li => {
    const name = li.dataset.name;
    const logVisivel = li.querySelector(".log-container")?.style.display === "block";
    if (logVisivel && name) logsAbertos.add(name);
  });

  ul.innerHTML = "";

  dados.forEach(item => {
    const li = document.createElement("li");
    li.dataset.name = item.name || "desconhecido";
    
    // Main div with data (name, start, end)
    const divInfo = document.createElement("div");
    let text = `<b>Folder:</b> <span>${item.name || "name não disponível"}</span> — `;
    
    if (item.start) {
        const inicioDate = new Date(item.start);
        const inicio = `${inicioDate.getFullYear()}/${String(inicioDate.getMonth() + 1).padStart(2, '0')}/${String(inicioDate.getDate()).padStart(2, '0')} ${String(inicioDate.getHours()).padStart(2, '0')}:${String(inicioDate.getMinutes()).padStart(2, '0')}:${String(inicioDate.getSeconds()).padStart(2, '0')}`;
        text += `<b>Starting at: </b> ${inicio} — `;
    } else {
        text += "<b>Starting at: -- </b> — ";
    }
  
    if (item.completed && item.end) {
        const fimDate = new Date(item.end * 1000);
        const fim = `${fimDate.getFullYear()}/${String(fimDate.getMonth() + 1).padStart(2, '0')}/${String(fimDate.getDate()).padStart(2, '0')} ${String(fimDate.getHours()).padStart(2, '0')}:${String(fimDate.getMinutes()).padStart(2, '0')}:${String(fimDate.getSeconds()).padStart(2, '0')}`;
        text += `<b>Ending at:</b> ${fim}`;
    } else {
        text += "<b>Ending at: -- </b> ";
    }
    
    divInfo.innerHTML = `<p>${text}</p>`;
    
    // Status div (below info, above log)
    const divStatus = document.createElement("div");
    divStatus.className = "status-container";
    
    let textStatus = "";
    let status = item.results || "Annotating ...";
    textStatus += `<b>Status:</b> ${status}`;
    
    divStatus.innerHTML = `<p>${textStatus}</p>`;
    
    // Div do log
    const divLog = document.createElement("div");
    divLog.className = "log-container";

    const logContent = item.last_lines_log?.length > 0
      ? item.last_lines_log.join("<br>")
      : "No log lines.";

    divLog.innerHTML = `<div class="log">${logContent}</div>`;
    divLog.style.display = "none";

    // Toggle button
    const toggleBtn = document.createElement("button");
    toggleBtn.classList.add("toggle-log-btn"); 
    toggleBtn.textContent = "Show log";

    toggleBtn.onclick = () => {
      const isHidden = divLog.style.display === "none";
      divLog.style.display = isHidden ? "block" : "none";
      toggleBtn.textContent = isHidden ? "Hide log" : "Show log";
    };

    // Restore expansion
    if (logsAbertos.has(item.name)) {
      divLog.style.display = "block";
      toggleBtn.textContent = "Hide log";
    }


    // Correct order of assembly
    li.appendChild(divInfo);
    li.appendChild(divStatus);
    li.appendChild(toggleBtn);
    li.appendChild(divLog);
    ul.appendChild(li);

  });
}

setInterval(atualizarStatus, 10000);
atualizarStatus();