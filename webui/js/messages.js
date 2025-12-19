// message actions and components
import { store as imageViewerStore } from "../components/modals/image-viewer/image-viewer-store.js";
import { marked } from "../vendor/marked/marked.esm.js";
import { store as _messageResizeStore } from "/components/messages/resize/message-resize-store.js"; // keep here, required in html
import { store as attachmentsStore } from "/components/chat/attachments/attachmentsStore.js";
import { addActionButtonsToElement } from "/components/messages/action-buttons/simple-action-buttons.js";

// Get chatHistory lazily to ensure DOM is ready
function getChatHistory() {
  return document.getElementById("chat-history");
}

let messageGroup = null;

// Simplified implementation - no complex interactions needed

export function setMessage(id, type, heading, content, temp, kvps = null) {
  // Search for the existing message container by id
  let messageContainer = document.getElementById(`message-${id}`);
  let isNewMessage = false;

  if (messageContainer) {
    // Don't clear innerHTML - we'll do incremental updates
    // messageContainer.innerHTML = "";
  } else {
    // Create a new container if not found
    isNewMessage = true;
    const sender = type === "user" ? "user" : "ai";
    messageContainer = document.createElement("div");
    messageContainer.id = `message-${id}`;
    // Tailwind classes for message container
    messageContainer.className = `flex w-full mb-4 ${sender === 'user' ? 'justify-end' : 'justify-start'}`;
  }

  const handler = getHandler(type);
  handler(messageContainer, id, type, heading, content, temp, kvps);

  // If this is a new message, handle DOM insertion
  if (!document.getElementById(`message-${id}`)) {
    // message type visual grouping
    // In Tailwind version, we'll keep it simple for now, but preserving group logic
    const groupTypeMap = {
      user: "right",
      info: "mid",
      warning: "mid",
      error: "mid",
      rate_limit: "mid",
      util: "mid",
      hint: "mid",
      // anything else is "left"
    };
    //force new group on these types
    const groupStart = {
      agent: true,
      // anything else is false
    };

    const groupType = groupTypeMap[type] || "left";

    // here check if messageGroup is still in DOM, if not, then set it to null (context switch)
    if (messageGroup && !document.getElementById(messageGroup.id))
      messageGroup = null;

    if (
      !messageGroup || // no group yet exists
      groupStart[type] || // message type forces new group
      groupType != messageGroup.getAttribute("data-group-type") // message type changes group
    ) {
      messageGroup = document.createElement("div");
      messageGroup.id = `message-group-${id}`;
      // Tailwind classes for message group
      messageGroup.className = `flex flex-col gap-1 w-full px-4 md:px-0 max-w-4xl mx-auto`;
      messageGroup.setAttribute("data-group-type", groupType);
    }
    messageGroup.appendChild(messageContainer);
    getChatHistory().appendChild(messageGroup);
  }

  // Simplified implementation - no setup needed

  return messageContainer;
}

// Legacy copy button functions removed - now using action buttons component

export function getHandler(type) {
  switch (type) {
    case "user":
      return drawMessageUser;
    case "agent":
      return drawMessageAgent;
    case "response":
      return drawMessageResponse;
    case "tool":
      return drawMessageTool;
    case "code_exe":
      return drawMessageCodeExe;
    case "browser":
      return drawMessageBrowser;
    case "warning":
      return drawMessageWarning;
    case "rate_limit":
      return drawMessageWarning;
    case "error":
      return drawMessageError;
    case "info":
      return drawMessageInfo;
    case "util":
      return drawMessageInfo;
    case "hint":
      return drawMessageInfo;
    default:
      return drawMessageDefault;
  }
}

// draw a message with a specific type
export function _drawMessage(
  messageContainer,
  heading,
  content,
  temp,
  followUp,
  mainClass = "",
  kvps = null,
  messageClasses = [], // These are legacy classes, we might ignore or map them
  contentClasses = [], // Legacy content classes
  latex = false,
  markdown = false,
  resizeBtns = true
) {
  // Find existing message div or create new one
  let messageDiv = messageContainer.querySelector(".message-bubble"); // Changed class name to be specific
  if (!messageDiv) {
    messageDiv = document.createElement("div");
    // Tailwind classes for message bubble
    // We'll set base classes here, specific colors come from helper functions
    messageDiv.className = "message-bubble relative p-4 text-sm rounded-xl shadow-sm max-w-[95%] md:max-w-[85%] group";
    messageContainer.appendChild(messageDiv);
  }
  
  // Add mainClass to container for CSS targeting (e.g., message-util for preferences toggle)
  if (mainClass) {
    messageContainer.classList.add(mainClass);
  }

  // Handle heading
  if (heading) {
    let headingElement = messageDiv.querySelector(".msg-heading");
    if (!headingElement) {
      headingElement = document.createElement("div");
      headingElement.className = "msg-heading flex items-center justify-between mb-2 pb-1 border-b border-gray-100 dark:border-gray-700";
      messageDiv.insertBefore(headingElement, messageDiv.firstChild);
    }

    let headingH4 = headingElement.querySelector("h4");
    if (!headingH4) {
      headingH4 = document.createElement("h4");
      headingH4.className = "text-sm font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-2";
      headingElement.appendChild(headingH4);
    }
    headingH4.innerHTML = convertIcons(escapeHTML(heading));

    if (resizeBtns) {
      let minMaxBtn = headingElement.querySelector(".msg-min-max-btns");
      if (!minMaxBtn) {
        minMaxBtn = document.createElement("div");
        minMaxBtn.className = "msg-min-max-btns flex gap-1";
        minMaxBtn.innerHTML = `
          <a href="#" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" @click.prevent="$store.messageResize.minimizeMessageClass('${mainClass}', $event)"><span class="material-symbols-outlined text-sm" x-text="$store.messageResize.getSetting('${mainClass}').minimized ? 'expand_content' : 'minimize'"></span></a>
          <a href="#" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" x-show="!$store.messageResize.getSetting('${mainClass}').minimized" @click.prevent="$store.messageResize.maximizeMessageClass('${mainClass}', $event)"><span class="material-symbols-outlined text-sm" x-text="$store.messageResize.getSetting('${mainClass}').maximized ? 'expand' : 'expand_all'"></span></a>
        `;
        headingElement.appendChild(minMaxBtn);
      }
    }
  } else {
    const existingHeading = messageDiv.querySelector(".msg-heading");
    if (existingHeading) {
      existingHeading.remove();
    }
  }

  // Find existing body div or create new one
  let bodyDiv = messageDiv.querySelector(".message-body");
  if (!bodyDiv) {
    bodyDiv = document.createElement("div");
    // Tailwind classes for body
    bodyDiv.className = "message-body overflow-x-auto";
    messageDiv.appendChild(bodyDiv);
  }

  // reapply scroll position or autoscroll
  const scroller = new Scroller(bodyDiv);

  // Handle KVPs incrementally
  drawKvpsIncremental(bodyDiv, kvps, false);

  // Handle content
  if (content && content.trim().length > 0) {
    if (markdown) {
      let contentDiv = bodyDiv.querySelector(".msg-content");
      if (!contentDiv) {
        contentDiv = document.createElement("div");
        bodyDiv.appendChild(contentDiv);
      }
      // Tailwind classes for content (prose-like styling)
      contentDiv.className = `msg-content text-gray-800 dark:text-gray-200 leading-relaxed space-y-2 break-words break-all ${contentClasses.join(" ")}`;

      let spanElement = contentDiv.querySelector("span");
      if (!spanElement) {
        spanElement = document.createElement("span");
        contentDiv.appendChild(spanElement);
      }

      let processedContent = content;
      processedContent = convertImageTags(processedContent);
      processedContent = convertImgFilePaths(processedContent);
      processedContent = marked.parse(processedContent, { breaks: true });
      processedContent = convertPathsToLinks(processedContent);
      processedContent = addBlankTargetsToLinks(processedContent);

      spanElement.innerHTML = processedContent;

      // KaTeX rendering for markdown
      if (latex) {
        spanElement.querySelectorAll("latex").forEach((element) => {
          katex.render(element.innerHTML, element, {
            throwOnError: false,
          });
        });
      }

      // Ensure action buttons exist
      addActionButtonsToElement(bodyDiv);
      adjustMarkdownRender(contentDiv);

    } else {
      let preElement = bodyDiv.querySelector(".msg-content");
      if (!preElement) {
        preElement = document.createElement("pre");
        // Tailwind classes for pre content
        preElement.className = `msg-content whitespace-pre-wrap break-words font-mono text-xs bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 ${contentClasses.join(" ")}`;
        bodyDiv.appendChild(preElement);
      } else {
        preElement.className = `msg-content whitespace-pre-wrap break-words font-mono text-xs bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 ${contentClasses.join(" ")}`;
      }

      let spanElement = preElement.querySelector("span");
      if (!spanElement) {
        spanElement = document.createElement("span");
        preElement.appendChild(spanElement);
      }

      spanElement.innerHTML = escapeHTML(content);

      // Ensure action buttons exist
      addActionButtonsToElement(bodyDiv);

    }
  } else {
    // Remove content if it exists but content is empty
    const existingContent = bodyDiv.querySelector(".msg-content");
    if (existingContent) {
      existingContent.remove();
    }
  }

  // reapply scroll position or autoscroll
  scroller.reApplyScroll();

  if (followUp) {
    messageContainer.classList.add("mt-0"); // Less margin for followups
  }

  return messageDiv;
}

export function addBlankTargetsToLinks(str) {
  const doc = new DOMParser().parseFromString(str, "text/html");

  doc.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href") || "";
    if (
      href.startsWith("#") ||
      href.trim().toLowerCase().startsWith("javascript")
    )
      return;
    if (
      !anchor.hasAttribute("target") ||
      anchor.getAttribute("target") === ""
    ) {
      anchor.setAttribute("target", "_blank");
    }

    const rel = (anchor.getAttribute("rel") || "").split(/\s+/).filter(Boolean);
    if (!rel.includes("noopener")) rel.push("noopener");
    if (!rel.includes("noreferrer")) rel.push("noreferrer");
    anchor.setAttribute("rel", rel.join(" "));
    
    // Add styling classes to links
    anchor.classList.add("text-blue-600", "dark:text-blue-400", "hover:underline");
  });
  return doc.body.innerHTML;
}

// === Helper Draw Functions ===

function setBubbleStyle(messageDiv, styleType) {
    // Reset base classes
    messageDiv.className = "message-bubble relative p-4 text-sm rounded-xl shadow-sm max-w-[95%] md:max-w-[85%] group border";
    
    if (styleType === 'user') {
        messageDiv.classList.add("bg-blue-50", "text-blue-900", "border-blue-100", "rounded-tr-none", "dark:bg-blue-900/40", "dark:border-blue-800", "dark:text-blue-100");
    } else if (styleType === 'agent') {
        messageDiv.classList.add("bg-white", "text-gray-900", "border-gray-200", "rounded-tl-none", "dark:bg-gray-800", "dark:border-gray-700", "dark:text-gray-100");
    } else if (styleType === 'tool') {
        messageDiv.classList.add("bg-gray-50", "text-gray-800", "border-gray-200", "rounded-xl", "dark:bg-gray-800/50", "dark:border-gray-700", "dark:text-gray-200");
    } else if (styleType === 'error') {
        messageDiv.classList.add("bg-red-50", "text-red-900", "border-red-100", "rounded-xl", "dark:bg-red-900/30", "dark:border-red-800", "dark:text-red-100");
    } else if (styleType === 'warning') {
        messageDiv.classList.add("bg-yellow-50", "text-yellow-900", "border-yellow-100", "rounded-xl", "dark:bg-yellow-900/30", "dark:border-yellow-800", "dark:text-yellow-100");
    } else if (styleType === 'info') {
        messageDiv.classList.add("bg-blue-50", "text-blue-800", "border-blue-100", "rounded-xl", "dark:bg-blue-900/30", "dark:border-blue-800", "dark:text-blue-100");
    }
}

export function drawMessageDefault(
  messageContainer,
  id,
  type,
  heading,
  content,
  temp,
  kvps = null
) {
  const div = _drawMessage(
    messageContainer,
    heading,
    content,
    temp,
    false,
    "message-default",
    kvps,
    [],
    [],
    false,
    false
  );
  setBubbleStyle(div, 'agent');
}

export function drawMessageAgent(
  messageContainer,
  id,
  type,
  heading,
  content,
  temp,
  kvps = null
) {
  let kvpsFlat = null;
  if (kvps) {
    kvpsFlat = { ...kvps, ...(kvps["tool_args"] || {}) };
    delete kvpsFlat["tool_args"];
  }

  const div = _drawMessage(
    messageContainer,
    heading,
    content,
    temp,
    false,
    "message-agent",
    kvpsFlat,
    [],
    ["msg-json"], // Add msg-json class to content for Show JSON toggle
    false,
    false
  );
  setBubbleStyle(div, 'agent');
}

export function drawMessageResponse(
  messageContainer,
  id,
  type,
  heading,
  content,
  temp,
  kvps = null
) {
  const div = _drawMessage(
    messageContainer,
    heading,
    content,
    temp,
    true,
    "message-agent-response",
    null,
    [],
    [],
    true,
    true
  );
  setBubbleStyle(div, 'agent');
  // Add special styling for response
  div.classList.add("ring-1", "ring-purple-100", "dark:ring-purple-900");
}

export function drawMessageUser(
  messageContainer,
  id,
  type,
  heading,
  content,
  temp,
  kvps = null,
  latex = false
) {
  // Find existing message div or create new one
  let messageDiv = messageContainer.querySelector(".message-bubble");
  if (!messageDiv) {
    messageDiv = document.createElement("div");
    // User bubble style
    setBubbleStyle(messageDiv, 'user');
    messageContainer.appendChild(messageDiv);
  }

  // Handle heading
  let headingElement = messageDiv.querySelector(".msg-heading");
  if (!headingElement) {
    headingElement = document.createElement("h4");
    headingElement.className = "msg-heading text-xs font-bold mb-2 flex items-center justify-end gap-2 opacity-70";
    messageDiv.insertBefore(headingElement, messageDiv.firstChild);
  }
  headingElement.innerHTML = `${heading} <span class='material-symbols-outlined text-sm'>person</span>`;

  // Handle content
  let textDiv = messageDiv.querySelector(".message-text");
  if (content && content.trim().length > 0) {
    if (!textDiv) {
      textDiv = document.createElement("div");
      textDiv.className = "message-text whitespace-pre-wrap break-words break-all leading-relaxed";
      messageDiv.appendChild(textDiv);
    }
    let spanElement = textDiv.querySelector("span.user-content");
    if (!spanElement) {
        spanElement = document.createElement("span");
        spanElement.className = "user-content";
        textDiv.appendChild(spanElement);
    }
    spanElement.innerHTML = escapeHTML(content);
    addActionButtonsToElement(textDiv);
  } else {
    if (textDiv) textDiv.remove();
  }

  // Handle attachments
  let attachmentsContainer = messageDiv.querySelector(".attachments-container");
  if (kvps && kvps.attachments && kvps.attachments.length > 0) {
    if (!attachmentsContainer) {
      attachmentsContainer = document.createElement("div");
      attachmentsContainer.className = "attachments-container grid grid-cols-2 gap-2 mt-3";
      messageDiv.appendChild(attachmentsContainer);
    }
    // Important: Clear existing attachments to re-render, preventing duplicates on update
    attachmentsContainer.innerHTML = ""; 

    kvps.attachments.forEach((attachment) => {
      const attachmentDiv = document.createElement("div");
      attachmentDiv.className = "attachment-item relative group overflow-hidden rounded-lg border border-blue-200 dark:border-blue-700 bg-white dark:bg-blue-900/20 hover:shadow-md transition-all cursor-pointer";

      const displayInfo = attachmentsStore.getAttachmentDisplayInfo(attachment);

      if (displayInfo.isImage) {
        const img = document.createElement("img");
        img.src = displayInfo.previewUrl;
        img.alt = displayInfo.filename;
        img.className = "w-full h-24 object-cover";
        
        attachmentDiv.appendChild(img);
      } else {
        attachmentDiv.classList.add("flex", "items-center", "p-2", "gap-2");
        
        // File icon
        if (
          displayInfo.previewUrl &&
          displayInfo.previewUrl !== displayInfo.filename
        ) {
          const iconImg = document.createElement("img");
          iconImg.src = displayInfo.previewUrl;
          iconImg.alt = `${displayInfo.extension} file`;
          iconImg.className = "w-8 h-8";
          attachmentDiv.appendChild(iconImg);
        }

        // File title
        const fileTitle = document.createElement("div");
        fileTitle.className = "text-xs font-medium truncate max-w-full";
        fileTitle.textContent = displayInfo.filename;

        attachmentDiv.appendChild(fileTitle);
      }

      attachmentDiv.addEventListener("click", displayInfo.clickHandler);

      attachmentsContainer.appendChild(attachmentDiv);
    });
  } else {
    if (attachmentsContainer) attachmentsContainer.remove();
  }
}

export function drawMessageTool(
  messageContainer,
  id,
  type,
  heading,
  content,
  temp,
  kvps = null
) {
  const div = _drawMessage(
    messageContainer,
    heading,
    content,
    temp,
    true,
    "message-tool",
    kvps,
    [],
    [], // was msg-output, handled in _drawMessage now
    false,
    false
  );
  setBubbleStyle(div, 'tool');
}

export function drawMessageCodeExe(
  messageContainer,
  id,
  type,
  heading,
  content,
  temp,
  kvps = null
) {
  const div = _drawMessage(
    messageContainer,
    heading,
    content,
    temp,
    true,
    "message-code-exe",
    null,
    [],
    [],
    false,
    false
  );
  setBubbleStyle(div, 'tool'); // Use tool style for code exe too, or maybe darker
  div.classList.add("bg-gray-100", "dark:bg-gray-900"); // Override background for code
}

export function drawMessageBrowser(
  messageContainer,
  id,
  type,
  heading,
  content,
  temp,
  kvps = null
) {
  const div = _drawMessage(
    messageContainer,
    heading,
    content,
    temp,
    true,
    "message-browser",
    kvps,
    [],
    [],
    false,
    false
  );
  setBubbleStyle(div, 'tool');
}

export function drawMessageAgentPlain(
  mainClass,
  messageContainer,
  id,
  type,
  heading,
  content,
  temp,
  kvps = null
) {
  const div = _drawMessage(
    messageContainer,
    heading,
    content,
    temp,
    false,
    mainClass,
    kvps,
    [],
    [],
    false,
    false
  );
  messageContainer.classList.add("justify-center"); // Center these messages
  div.className = "message-bubble relative p-3 text-xs text-center rounded-lg bg-gray-100 text-gray-600 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 max-w-[90%]";
}

export function drawMessageInfo(
  messageContainer,
  id,
  type,
  heading,
  content,
  temp,
  kvps = null
) {
  const div = _drawMessage(
    messageContainer,
    heading,
    content,
    temp,
    false,
    "message-util",
    kvps,
    [],
    [],
    false,
    false
  );
  messageContainer.classList.add("justify-center");
  // Flowbite-style subtle info card
  div.className = "message-bubble relative px-4 py-2 text-xs text-center rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 shadow-sm max-w-[90%]";
}

export function drawMessageWarning(
  messageContainer,
  id,
  type,
  heading,
  content,
  temp,
  kvps = null
) {
  const div = _drawMessage(
    messageContainer,
    heading,
    content,
    temp,
    false,
    "message-warning",
    kvps,
    [],
    [],
    false,
    false
  );
  messageContainer.classList.add("justify-center");
  setBubbleStyle(div, 'warning');
}

export function drawMessageError(
  messageContainer,
  id,
  type,
  heading,
  content,
  temp,
  kvps = null
) {
  const div = _drawMessage(
    messageContainer,
    heading,
    content,
    temp,
    false,
    "message-error",
    kvps,
    [],
    [],
    false,
    false
  );
  messageContainer.classList.add("justify-center");
  setBubbleStyle(div, 'error');
}

function drawKvpsIncremental(container, kvps, latex) {
  if (kvps) {
    // Find existing table or create new one
    let table = container.querySelector(".msg-kvps");
    if (!table) {
      table = document.createElement("table");
      table.className = "msg-kvps w-full text-sm text-left mt-3 border-separate border-spacing-y-2";
      container.appendChild(table);
    }

    // Get all current rows for comparison
    let existingRows = table.querySelectorAll("tr");
    const kvpEntries = Object.entries(kvps);

    // Update or create rows as needed
    kvpEntries.forEach(([key, value], index) => {
      let row = existingRows[index];

      if (!row) {
        // Create new row if it doesn't exist
        row = table.insertRow();
      }

      // Update row classes - Flowbite consistent styling with color coding
      row.className = "kvps-row";
      
      // Color-coded backgrounds based on key type + preference toggle classes
      if (key === "thoughts" || key === "reasoning") {
        row.classList.add("bg-purple-50", "dark:bg-purple-900/20", "msg-thoughts");
      } else if (key === "text" || key === "content" || key === "response") {
        row.classList.add("bg-green-50", "dark:bg-green-900/20");
      }

      // Handle key cell - Color-coded label styling based on key type
      let th = row.querySelector("th");
      if (!th) {
        th = document.createElement("th");
        row.appendChild(th);
      }
      
      // Apply color based on key type for better differentiation
      let labelColor = "text-blue-600 dark:text-blue-400"; // default
      if (key === "thoughts" || key === "reasoning") {
        labelColor = "text-purple-600 dark:text-purple-400";
      } else if (key === "headline" || key === "tool_name") {
        labelColor = "text-amber-600 dark:text-amber-400";
      } else if (key === "text" || key === "content" || key === "response") {
        labelColor = "text-green-600 dark:text-green-400";
      } else if (key === "query" || key === "memories") {
        labelColor = "text-cyan-600 dark:text-cyan-400";
      } else if (key === "result" || key === "finished") {
        labelColor = "text-emerald-600 dark:text-emerald-400";
      }
      th.className = `kvps-key py-1.5 pr-3 font-semibold whitespace-nowrap align-top ${labelColor} w-1 text-xs uppercase tracking-wide`;
      th.textContent = convertToTitleCase(key);

      // Handle value cell
      let td = row.querySelector("td");
      if (!td) {
        td = document.createElement("td");
        td.className = "py-1.5 align-top break-all";
        row.appendChild(td);
      }

      let tdiv = td.querySelector(".kvps-val");
      if (!tdiv) {
        tdiv = document.createElement("div");
        tdiv.className = "kvps-val text-gray-700 dark:text-gray-300";
        td.appendChild(tdiv);
      }

      // reapply scroll position or autoscroll
      const scroller = new Scroller(tdiv);

      // Clear and rebuild content (for now - could be optimized further)
      tdiv.innerHTML = "";

      addActionButtonsToElement(tdiv);

      if (Array.isArray(value)) {
        for (const item of value) {
          addValue(item, tdiv);
        }
      } else {
        addValue(value, tdiv);
      }

      // reapply scroll position or autoscroll
      scroller.reApplyScroll();
    });

    // Remove extra rows if we have fewer kvps now
    while (existingRows.length > kvpEntries.length) {
      const lastRow = existingRows[existingRows.length - 1];
      lastRow.remove();
      existingRows = table.querySelectorAll("tr");
    }

    function addValue(value, tdiv) {
      if (typeof value === "object") value = JSON.stringify(value, null, 2);

      if (typeof value === "string" && value.startsWith("img://")) {
        const imgElement = document.createElement("img");
        imgElement.className = "max-w-xs rounded shadow-sm hover:opacity-90 transition-opacity cursor-pointer mt-1";
        imgElement.src = value.replace("img://", "/image_get?path=");
        imgElement.alt = "Image Attachment";
        tdiv.appendChild(imgElement);

        imgElement.addEventListener("click", () => {
          imageViewerStore.open(imgElement.src, { refreshInterval: 1000 });
        });
      } else {
        const pre = document.createElement("pre");
        pre.className = "whitespace-pre-wrap font-sans text-sm"; // Default to sans for most values
        
        // If value looks like code or JSON, use Flowbite code block styling
        const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
        if (valueStr && (valueStr.includes('\n') || valueStr.includes('{') || valueStr.includes('  '))) {
            pre.className = "whitespace-pre-wrap font-mono text-xs bg-gray-100 dark:bg-gray-900 p-3 rounded-lg border border-gray-200 dark:border-gray-700 mt-2 overflow-x-auto";
        }

        const span = document.createElement("span");
        span.innerHTML = escapeHTML(valueStr);
        pre.appendChild(span);
        tdiv.appendChild(pre);

        if (latex) {
          span.querySelectorAll("latex").forEach((element) => {
            katex.render(element.innerHTML, element, {
              throwOnError: false,
            });
          });
        }
      }
    }
  } else {
    // Remove table if kvps is null/empty
    const existingTable = container.querySelector(".msg-kvps");
    if (existingTable) {
      existingTable.remove();
    }
  }
}

function convertToTitleCase(str) {
  return str
    .replace(/_/g, " ") // Replace underscores with spaces
    .toLowerCase() // Convert the entire string to lowercase
    .replace(/\b\w/g, function (match) {
      return match.toUpperCase(); // Capitalize the first letter of each word
    });
}

function convertImageTags(content) {
  // Regular expression to match <image> tags and extract base64 content
  const imageTagRegex = /<image>(.*?)<\/image>/g;

  // Replace <image> tags with <img> tags with base64 source
  const updatedContent = content.replace(
    imageTagRegex,
    (match, base64Content) => {
      return `<img src="data:image/jpeg;base64,${base64Content}" alt="Image Attachment" class="max-w-xs rounded shadow-sm my-2" />`;
    }
  );

  return updatedContent;
}

function convertImgFilePaths(str) {
  return str.replace(/img:\/\//g, "/image_get?path=");
}

export function convertIcons(str) {
  return str.replace(
    /icon:\/\/([a-zA-Z0-9_]+)/g,
    '<span class="material-symbols-outlined align-text-bottom text-base mr-1">$1</span>'
  );
}

function escapeHTML(str) {
  const escapeChars = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  };
  return str.replace(/[&<>'"]/g, (char) => escapeChars[char]);
}

function convertPathsToLinks(str) {
  function generateLinks(match) {
    const parts = match.split("/");
    if (!parts[0]) parts.shift(); // drop empty element left of first "
    let conc = "";
    let html = "";
    for (const part of parts) {
      conc += "/" + part;
      html += `/<a href="#" class="text-blue-600 dark:text-blue-400 hover:underline" onclick="openFileLink('${conc}');">${part}</a>`;
    }
    return html;
  }

  const prefix = `(?:^|[> \`'"\\n]|&#39;|&quot;)`;
  const folder = `[a-zA-Z0-9_\\/.\\-]`;
  const file = `[a-zA-Z0-9_\\-\\/]`;
  const suffix = `(?<!\\.)`;
  const pathRegex = new RegExp(
    `(?<=${prefix})\\/${folder}*${file}${suffix}`,
    "g"
  );

  // skip paths inside html tags, like <img src="/path/to/image">
  const tagRegex = /(<(?:[^<>"']+|"[^"]*"|'[^']*')*>)/g;

  return str
    .split(tagRegex) // keep tags & text separate
    .map((chunk) => {
      // if it *starts* with '<', it's a tag -> leave untouched
      if (chunk.startsWith("<")) return chunk;
      // otherwise run your link-generation
      return chunk.replace(pathRegex, generateLinks);
    })
    .join("");
}

function adjustMarkdownRender(element) {
  // find all tables in the element
  const elements = element.querySelectorAll("table");

  // wrap each with a div with class message-markdown-table-wrap
  elements.forEach((el) => {
    // Add Flowbite table classes
    el.classList.add("w-full", "text-sm", "text-left", "text-gray-500", "dark:text-gray-400", "border-collapse", "my-2");
    
    // Add styles to th and td
    el.querySelectorAll('th').forEach(th => {
        th.className = "px-4 py-2 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-semibold";
    });
    el.querySelectorAll('td').forEach(td => {
        td.className = "px-4 py-2 border border-gray-200 dark:border-gray-600";
    });

    const wrapper = document.createElement("div");
    wrapper.className = "overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 my-2";
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);
  });
  
  // Style blockquotes
  element.querySelectorAll('blockquote').forEach(bq => {
      bq.className = "border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2 text-gray-600 dark:text-gray-400";
  });
  
  // Style lists
  element.querySelectorAll('ul').forEach(ul => {
      ul.className = "list-disc list-inside space-y-1 my-2";
  });
  element.querySelectorAll('ol').forEach(ol => {
      ol.className = "list-decimal list-inside space-y-1 my-2";
  });
  
  // Style code blocks
  element.querySelectorAll('pre code').forEach(code => {
      // Styling is handled by pre wrapper usually, but ensuring font
      code.classList.add("font-mono", "text-sm");
  });
  
  // Inline code
  element.querySelectorAll(':not(pre) > code').forEach(code => {
      code.className = "font-mono text-xs bg-gray-100 dark:bg-gray-700 text-red-500 dark:text-red-400 px-1 py-0.5 rounded";
  });
}

class Scroller {
  constructor(element) {
    this.element = element;
    this.wasAtBottom = this.isAtBottom();
  }

  isAtBottom(tolerance = 10) {
    const scrollHeight = this.element.scrollHeight;
    const clientHeight = this.element.clientHeight;
    const distanceFromBottom =
      scrollHeight - this.element.scrollTop - clientHeight;
    return distanceFromBottom <= tolerance;
  }

  reApplyScroll() {
    if (this.wasAtBottom) this.element.scrollTop = this.element.scrollHeight;
  }
}