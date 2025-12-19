// Simplified Message Action Buttons - Keeping the Great Look & Feel
import { store as speechStore } from "/components/chat/speech/speech-store.js";

// Extract text content from different message types
function getTextContent(element,html=false) {
  // Get all children except action buttons
  const textParts = [];
  // Loop through all child elements
  for (const child of element.children) {
    // Skip action buttons
    if (child.classList.contains("action-buttons") || child.closest('.action-buttons-container')) continue;
    // If the child is an image, copy its src URL
    if (child.tagName && child.tagName.toLowerCase() === "img") {
      if (child.src) textParts.push(child.src);
      continue;
    }
    // Get text content from the child
    const text = (html ? child.innerHTML : child.innerText) || "";
    if (text.trim()) {
      textParts.push(text.trim());
    }
  }
  // Join all text parts with double newlines
  return textParts.join("\n\n");
}


// Create and add action buttons to element
export function addActionButtonsToElement(element) {
  // Skip if buttons already exist
  if (element.querySelector(".action-buttons-container")) return;

  // Create container with Tailwind classes
  const container = document.createElement("div");
  container.className = "action-buttons-container absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10";
  
  // Also support hover on the element itself if it's not a group (fallback)
  // But ideally the parent message container should have 'group' class.
  // We'll rely on the parent having 'group' or adding hover logic here if needed.
  // Actually, messages.js should add 'group' to message bubbles.

  // Copy button
  const copyBtn = document.createElement("button");
  copyBtn.className = "flex items-center justify-center w-7 h-7 text-gray-400 bg-white border border-gray-200 rounded hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors shadow-sm";
  copyBtn.setAttribute("aria-label", "Copy text");
  copyBtn.innerHTML =
    '<span class="material-symbols-outlined text-[16px]">content_copy</span>';

  copyBtn.onclick = async (e) => {
    e.stopPropagation();

    // Check if the button container is still fading in (opacity < 0.5)
    if (parseFloat(window.getComputedStyle(container).opacity) < 0.1) return; 

    const text = getTextContent(element);
    const icon = copyBtn.querySelector(".material-symbols-outlined");

    try {
      // Try modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for local dev
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-999999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      // Visual feedback
      icon.textContent = "check";
      copyBtn.classList.add("text-green-500", "border-green-500");
      copyBtn.classList.remove("text-gray-400", "border-gray-200", "dark:border-gray-700");
      
      setTimeout(() => {
        icon.textContent = "content_copy";
        copyBtn.classList.remove("text-green-500", "border-green-500");
        copyBtn.classList.add("text-gray-400", "border-gray-200", "dark:border-gray-700");
      }, 2000);
    } catch (err) {
      console.error("Copy failed:", err);
      icon.textContent = "error";
      copyBtn.classList.add("text-red-500", "border-red-500");
      
      setTimeout(() => {
        icon.textContent = "content_copy";
        copyBtn.classList.remove("text-red-500", "border-red-500");
      }, 2000);
    }
  };

  // Speak button
  const speakBtn = document.createElement("button");
  speakBtn.className = "flex items-center justify-center w-7 h-7 text-gray-400 bg-white border border-gray-200 rounded hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700 transition-colors shadow-sm";
  speakBtn.setAttribute("aria-label", "Speak text");
  speakBtn.innerHTML =
    '<span class="material-symbols-outlined text-[16px]">volume_up</span>';

  speakBtn.onclick = async (e) => {
    e.stopPropagation();

    // Check if the button container is still fading in (opacity < 0.5)
    if (parseFloat(window.getComputedStyle(container).opacity) < 0.1) return;

    const text = getTextContent(element);
    const icon = speakBtn.querySelector(".material-symbols-outlined");

    if (!text || text.trim().length === 0) return;

    try {
      // Visual feedback
      icon.textContent = "check";
      speakBtn.classList.add("text-green-500", "border-green-500");
      
      setTimeout(() => {
        icon.textContent = "volume_up";
        speakBtn.classList.remove("text-green-500", "border-green-500");
      }, 2000);

      // Use speech store
      await speechStore.speak(text);
    } catch (err) {
      console.error("Speech failed:", err);
      icon.textContent = "error";
      speakBtn.classList.add("text-red-500", "border-red-500");
      
      setTimeout(() => {
        icon.textContent = "volume_up";
        speakBtn.classList.remove("text-red-500", "border-red-500");
      }, 2000);
    }
  };

  container.append(copyBtn, speakBtn);
  
  // Add container - use absolute positioning relative to parent
  // Parent must have 'relative' class
  if (!element.classList.contains('relative')) {
      element.classList.add('relative');
  }
  // Ensure parent has 'group' class for hover effect
  if (!element.classList.contains('group')) {
      element.classList.add('group');
  }
  
  element.appendChild(container);
}

