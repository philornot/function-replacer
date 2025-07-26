class FunctionReplacer {
  constructor() {
    this.originalCode = "";
    this.processedCode = "";
    this.fileName = "";
    this.replacedFunctions = [];

    console.log("FunctionReplacer: Konstruktor wywołany");
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    console.log("FunctionReplacer: Inicjalizacja eventów");
    const fileInput = document.getElementById("fileInput");
    const codeInput = document.getElementById("codeInput");
    const processBtn = document.getElementById("processBtn");
    const copyBtn = document.getElementById("copyBtn");
    const downloadBtn = document.getElementById("downloadBtn");

    fileInput.addEventListener("change", (e) => this.handleFileUpload(e));
    codeInput.addEventListener("input", () => this.updateProcessButton());
    processBtn.addEventListener("click", () => this.processFunctions());
    copyBtn.addEventListener("click", () => this.copyToClipboard());
    downloadBtn.addEventListener("click", () => this.downloadFile());
  }

  handleFileUpload(event) {
    const file = event.target.files[0];
    const fileInfo = document.getElementById("fileInfo");
    console.log("handleFileUpload: file =", file);

    if (!file) {
      console.log("handleFileUpload: Brak pliku");
      fileInfo.classList.add("hidden");
      this.originalCode = "";
      this.updateProcessButton();
      return;
    }

    if (!file.name.endsWith(".py")) {
      console.log("handleFileUpload: Zły typ pliku", file.name);
      this.showFileInfo("❌ Błąd: Wybierz plik z rozszerzeniem .py", true);
      this.originalCode = "";
      this.updateProcessButton();
      return;
    }

    this.fileName = file.name;
    const reader = new FileReader();

    reader.onload = (e) => {
      this.originalCode = e.target.result;
      console.log(
        "handleFileUpload: Plik wczytany, długość kodu =",
        this.originalCode.length
      );
      this.showFileInfo(
        `✅ Wczytano: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
        false
      );
      this.updateProcessButton();
    };

    reader.onerror = () => {
      console.log("handleFileUpload: Błąd odczytu pliku");
      this.showFileInfo("❌ Błąd podczas odczytu pliku", true);
      this.originalCode = "";
      this.updateProcessButton();
    };

    reader.readAsText(file);
  }

  showFileInfo(message, isError = false) {
    console.log("showFileInfo:", message, "isError:", isError);
    const fileInfo = document.getElementById("fileInfo");
    fileInfo.textContent = message;
    fileInfo.classList.remove("hidden", "error");
    if (isError) {
      fileInfo.classList.add("error");
    }
  }

  updateProcessButton() {
    const processBtn = document.getElementById("processBtn");
    const codeInput = document.getElementById("codeInput");

    const hasFile =
      typeof this.originalCode === "string" && this.originalCode.length > 0;
    const hasCode = codeInput.value && codeInput.value.trim().length > 0;

    console.log(
      "updateProcessButton: hasFile =",
      hasFile,
      "hasCode =",
      hasCode
    );
    processBtn.disabled = !(hasFile && hasCode);
  }

  extractFunctions(code) {
    console.log(
      "extractFunctions: kod długość =",
      code ? code.length : "brak kodu"
    );
    const functions = [];
    const lines = code.split("\n");
    let currentFunction = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Znajdź definicję funkcji (tylko na początku linii lub z wcięciem)
      const functionMatch = line.match(
        /^(\s*)def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/
      );

      if (functionMatch) {
        const indent = functionMatch[1];
        const functionName = functionMatch[2];

        console.log(
          `extractFunctions: Znaleziono definicję funkcji '${functionName}' w linii ${
            i + 1
          }, wcięcie: '${indent}'`
        );

        // Jeśli poprzednia funkcja nie została zamknięta, zamknij ją
        if (currentFunction) {
          functions.push({
            name: currentFunction.name,
            code: currentFunction.lines.join("\n"),
            startLine: currentFunction.startLine,
            endLine: i - 1,
            indent: currentFunction.indent,
          });
        }

        // Rozpocznij nową funkcję
        currentFunction = {
          name: functionName,
          lines: [line],
          startLine: i,
          indent: indent,
        };
      } else if (currentFunction) {
        // Sprawdź czy linia należy do funkcji
        const lineIndent = line.match(/^(\s*)/)[1];
        const hasContent = trimmedLine.length > 0;

        if (
          hasContent &&
          lineIndent.length <= currentFunction.indent.length &&
          !trimmedLine.startsWith("#") &&
          !line.match(/^\s*$/)
        ) {
          console.log(
            `extractFunctions: Koniec funkcji '${currentFunction.name}' na linii ${i}`
          );
          // Koniec funkcji - nowa linia na tym samym lub mniejszym poziomie wcięcia
          functions.push({
            name: currentFunction.name,
            code: currentFunction.lines.join("\n"),
            startLine: currentFunction.startLine,
            endLine: i - 1,
            indent: currentFunction.indent,
          });
          currentFunction = null;

          // Sprawdź czy ta linia zaczyna nową funkcję
          const newFunctionMatch = line.match(
            /^(\s*)def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/
          );
          if (newFunctionMatch) {
            currentFunction = {
              name: newFunctionMatch[2],
              lines: [line],
              startLine: i,
              indent: newFunctionMatch[1],
            };
          }
        } else {
          // Linia należy do funkcji
          currentFunction.lines.push(line);
        }
      }
    }

    // Dodaj ostatnią funkcję jeśli istnieje
    if (currentFunction) {
      console.log(
        `extractFunctions: Dodano ostatnią funkcję '${currentFunction.name}'`
      );
      functions.push({
        name: currentFunction.name,
        code: currentFunction.lines.join("\n"),
        startLine: currentFunction.startLine,
        endLine: lines.length - 1,
        indent: currentFunction.indent,
      });
    }

    console.log("extractFunctions: znaleziono funkcji =", functions.length);
    functions.forEach((f) =>
      console.log(`  - ${f.name} (linie ${f.startLine + 1}-${f.endLine + 1})`)
    );
    return functions;
  }

  processFunctions() {
    const processBtn = document.getElementById("processBtn");
    const codeInput = document.getElementById("codeInput");
    const resultsSection = document.getElementById("resultsSection");

    console.log("processFunctions: start");
    // Pokaż status przetwarzania
    this.showStatus("🔄 Przetwarzanie funkcji...", "processing");
    processBtn.classList.add("loading");
    processBtn.disabled = true;

    try {
      const newCode = codeInput.value.trim();
      console.log("processFunctions: newCode długość =", newCode.length);

      // Wyodrębnij funkcje z nowego kodu
      const newFunctions = this.extractFunctions(newCode);
      console.log(
        "processFunctions: newFunctions =",
        newFunctions.map((f) => f.name)
      );

      if (newFunctions.length === 0) {
        throw new Error("Nie znaleziono funkcji w wklejonym kodzie");
      }

      // Wyodrębnij funkcje z oryginalnego kodu
      const originalFunctions = this.extractFunctions(this.originalCode);
      console.log(
        "processFunctions: originalFunctions =",
        originalFunctions.map((f) => f.name)
      );

      // Znajdź funkcje do zamiany
      const functionsToReplace = [];
      for (const newFunc of newFunctions) {
        const originalFunc = originalFunctions.find(
          (f) => f.name === newFunc.name
        );
        if (originalFunc) {
          functionsToReplace.push({
            name: newFunc.name,
            oldFunction: originalFunc,
            newFunction: newFunc,
          });
        }
      }
      console.log(
        "processFunctions: functionsToReplace =",
        functionsToReplace.map((f) => f.name)
      );

      if (functionsToReplace.length === 0) {
        throw new Error("Nie znaleziono pasujących funkcji do zamiany");
      }

      // Wykonaj zamianę
      this.processedCode = this.replaceFunctions(
        this.originalCode,
        functionsToReplace
      );
      this.replacedFunctions = functionsToReplace.map((f) => f.name);

      // Pokaż wyniki
      this.showResults();
      this.showStatus(
        `✅ Zamieniono ${functionsToReplace.length} funkcji`,
        "success"
      );

      // Automatycznie skopiuj do schowka
      this.autoClipboardCopy();
    } catch (error) {
      this.showStatus(`❌ Błąd: ${error.message}`, "error");
      console.error("Processing error:", error);
    } finally {
      processBtn.classList.remove("loading");
      processBtn.disabled = false;
      console.log("processFunctions: koniec");
    }
  }

  replaceFunctions(originalCode, replacements) {
    console.log(
      "replaceFunctions: start, replacements =",
      replacements.map((f) => f.name)
    );
    let lines = originalCode.split("\n");

    // Sortuj zamiany od końca do początku, żeby indeksy się nie przesuwały
    const sortedReplacements = [...replacements].sort(
      (a, b) => b.oldFunction.startLine - a.oldFunction.startLine
    );

    for (const replacement of sortedReplacements) {
      const { oldFunction, newFunction } = replacement;
      console.log(
        `replaceFunctions: Zamiana funkcji '${oldFunction.name}' od linii ${
          oldFunction.startLine + 1
        } do ${oldFunction.endLine + 1}`
      );
      console.log(
        `replaceFunctions: Stare wcięcie: '${oldFunction.indent}' (${oldFunction.indent.length})`
      );

      // Podziel nową funkcję na linie
      const newFunctionLines = newFunction.code.split("\n");

      // Znajdź wcięcie pierwszej linii nowej funkcji (def ...)
      const firstLine = newFunctionLines[0];
      const newFunctionIndentMatch = firstLine.match(/^(\s*)/);
      const newFunctionIndent = newFunctionIndentMatch
        ? newFunctionIndentMatch[1]
        : "";

      console.log(
        `replaceFunctions: Nowe wcięcie funkcji: '${newFunctionIndent}' (${newFunctionIndent.length})`
      );

      // Przetwórz każdą linię nowej funkcji
      const adjustedLines = newFunctionLines.map((line, index) => {
        if (line.trim() === "") {
          return ""; // Puste linie pozostają puste
        }

        // Usuń oryginalne wcięcie z nowej funkcji
        let contentWithoutIndent;
        if (line.startsWith(newFunctionIndent)) {
          contentWithoutIndent = line.slice(newFunctionIndent.length);
        } else {
          // Jeśli linia ma inne wcięcie, spróbuj zachować proporcje
          const lineIndentMatch = line.match(/^(\s*)/);
          const lineIndent = lineIndentMatch ? lineIndentMatch[1] : "";
          const extraIndent =
            lineIndent.length > newFunctionIndent.length
              ? lineIndent.slice(newFunctionIndent.length)
              : "";
          contentWithoutIndent = extraIndent + line.trim();
        }

        // Dodaj wcięcie starej funkcji
        const adjustedLine = oldFunction.indent + contentWithoutIndent;

        if (index === 0) {
          console.log(`replaceFunctions: Przykład zamiany linii:`);
          console.log(`  Oryginalna: '${line}'`);
          console.log(`  Dostosowana: '${adjustedLine}'`);
        }

        return adjustedLine;
      });

      // Zastąp linie w kodzie
      const startLine = oldFunction.startLine;
      const endLine = oldFunction.endLine;
      const linesToRemove = endLine - startLine + 1;

      console.log(
        `replaceFunctions: Usuwam ${linesToRemove} linii od ${
          startLine + 1
        }, dodaję ${adjustedLines.length} nowych linii`
      );

      lines.splice(startLine, linesToRemove, ...adjustedLines);
    }

    const result = lines.join("\n");
    console.log("replaceFunctions: koniec");
    return result;
  }

  showResults() {
    console.log("showResults: replacedFunctions =", this.replacedFunctions);
    const resultsSection = document.getElementById("resultsSection");
    const changesSummary = document.getElementById("changesSummary");
    const resultCode = document.getElementById("resultCode");

    // Pokaż sekcję wyników
    resultsSection.classList.remove("hidden");

    // Przygotuj podsumowanie zmian
    const summaryHTML = `
      <h3>📊 Podsumowanie zmian</h3>
      <ul class="changes-list">
        ${this.replacedFunctions
          .map(
            (name) => `<li>Zamieniono funkcję: <strong>${name}</strong></li>`
          )
          .join("")}
      </ul>
      <p><strong>Łącznie zamieniono: ${
        this.replacedFunctions.length
      } funkcji</strong></p>
    `;

    changesSummary.innerHTML = summaryHTML;

    // Pokaż kod (ograniczony do pierwszych 100 linii dla wydajności)
    const previewLines = this.processedCode.split("\n").slice(0, 100);
    const codePreview = previewLines.join("\n");
    const hasMore = this.processedCode.split("\n").length > 100;

    resultCode.textContent =
      codePreview +
      (hasMore ? "\n\n... (pełny kod dostępny po skopiowaniu/pobraniu)" : "");

    // Przewiń do wyników
    resultsSection.scrollIntoView({ behavior: "smooth" });
  }

  async autoClipboardCopy() {
    const copyBtn = document.getElementById("copyBtn");
    const originalText = copyBtn.innerHTML;

    try {
      await navigator.clipboard.writeText(this.processedCode);

      // Zmień tekst przycisku na 2 sekundy
      copyBtn.innerHTML = '<span class="btn-icon">✅</span>Skopiowano!';
      copyBtn.classList.add("copied");

      setTimeout(() => {
        copyBtn.innerHTML = originalText;
        copyBtn.classList.remove("copied");
      }, 2000);
    } catch (error) {
      console.error("Auto-copy failed:", error);
      // Fallback - spróbuj standardowej metody
      try {
        const textArea = document.createElement("textarea");
        textArea.value = this.processedCode;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);

        copyBtn.innerHTML = '<span class="btn-icon">✅</span>Skopiowano!';
        copyBtn.classList.add("copied");

        setTimeout(() => {
          copyBtn.innerHTML = originalText;
          copyBtn.classList.remove("copied");
        }, 2000);
      } catch (fallbackError) {
        console.error("Fallback copy also failed:", fallbackError);
      }
    }
  }
  async copyToClipboard() {
    try {
      await navigator.clipboard.writeText(this.processedCode);
      this.showToast("✅ Skopiowano do schowka!", "success");
    } catch (error) {
      // Fallback dla starszych przeglądarek
      const textArea = document.createElement("textarea");
      textArea.value = this.processedCode;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      this.showToast("✅ Skopiowano do schowka!", "success");
    }
    console.log("copyToClipboard: koniec");
  }

  downloadFile() {
    console.log("downloadFile: start");
    try {
      const blob = new Blob([this.processedCode], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = this.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast("✅ Plik pobrany!", "success");
    } catch (error) {
      this.showToast("❌ Błąd podczas pobierania", "error");
      console.error("Download error:", error);
    }
    console.log("downloadFile: koniec");
  }

  showStatus(message, type) {
    console.log("showStatus:", message, "type:", type);
    const status = document.getElementById("status");
    status.textContent = message;
    status.className = `status ${type}`;
    status.classList.remove("hidden");
  }

  showToast(message, type = "success") {
    console.log("showToast:", message, "type:", type);
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add("show");

    setTimeout(() => {
      toast.classList.remove("show");
      console.log("showToast: toast ukryty");
    }, 3000);
  }
}

// Inicjalizuj aplikację po załadowaniu DOM
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOMContentLoaded: inicjalizacja FunctionReplacer");
  new FunctionReplacer();
  console.log("DOMContentLoaded: FunctionReplacer zainicjalizowany");
});
