// Import the component loader and page utilities
import { importComponent } from "/js/components.js";

// Modal functionality
const modalStack = [];

// Create a single backdrop for all modals
const backdrop = document.createElement("div");
backdrop.className = "fixed inset-0 z-40 bg-gray-900/50 dark:bg-gray-900/80 backdrop-blur-sm transition-opacity";
backdrop.style.display = "none";
// backdrop.style.backdropFilter = "blur(5px)"; // Handled by backdrop-blur-sm
document.body.appendChild(backdrop);

// Function to update z-index for all modals and backdrop
function updateModalZIndexes() {
  // Base z-index for modals
  const baseZIndex = 50; // Flowbite defaults to 50

  // Update z-index for all modals
  modalStack.forEach((modal, index) => {
    // For first modal, z-index is baseZIndex
    // For second modal, z-index is baseZIndex + 20
    // This leaves room for the backdrop between them if needed, though we use one backdrop
    modal.element.style.zIndex = baseZIndex + index * 2;
  });

  // Always show backdrop
  backdrop.style.display = "block";

  if (modalStack.length > 1) {
    // For multiple modals, position backdrop between the top two
    const topModalIndex = modalStack.length - 1;
    const previousModalZIndex = baseZIndex + (topModalIndex - 1) * 2;
    backdrop.style.zIndex = previousModalZIndex + 1;
  } else if (modalStack.length === 1) {
    // For single modal, position backdrop below it
    backdrop.style.zIndex = baseZIndex - 1;
  } else {
    // No modals, hide backdrop
    backdrop.style.display = "none";
  }
}

// Function to create a new modal element
function createModalElement(path) {
  // Create modal element
  const newModal = document.createElement("div");
  // Flowbite modal wrapper classes
  newModal.className = "fixed top-0 left-0 right-0 z-50 hidden w-full p-4 overflow-x-hidden overflow-y-auto md:inset-0 h-[calc(100%-1rem)] max-h-full justify-center items-center flex";
  newModal.path = path; // save name to the object

  // Add click handlers to only close modal if both mousedown and mouseup are on the modal container
  let mouseDownTarget = null;
  newModal.addEventListener("mousedown", (event) => {
    mouseDownTarget = event.target;
  });
  newModal.addEventListener("mouseup", (event) => {
    if (event.target === newModal && mouseDownTarget === newModal) {
      closeModal();
    }
    mouseDownTarget = null;
  });


  // Create modal structure
  newModal.innerHTML = `
    <div class="relative w-full max-w-2xl max-h-full">
      <!-- Modal content -->
      <div class="relative bg-white rounded-lg shadow dark:bg-gray-700 flex flex-col max-h-[calc(100vh-2rem)]">
        <!-- Modal header -->
        <div class="flex items-start justify-between p-4 border-b rounded-t dark:border-gray-600 shrink-0">
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white modal-title"></h3>
          <button type="button" class="modal-close text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ml-auto inline-flex justify-center items-center dark:hover:bg-gray-600 dark:hover:text-white">
            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
            </svg>
            <span class="sr-only">Close modal</span>
          </button>
        </div>
        <!-- Modal body -->
        <div class="p-6 space-y-6 overflow-y-auto modal-scroll">
          <div class="modal-bd"></div>
        </div>
        <!-- Modal footer slot -->
        <div class="modal-footer-slot shrink-0 hidden"></div>
      </div>
    </div>
  `;

  // Setup close button handler for this specific modal
  const close_button = newModal.querySelector(".modal-close");
  close_button.addEventListener("click", () => closeModal());


  // Add modal to DOM
  document.body.appendChild(newModal);

  // Show the modal (remove hidden, add flex)
  newModal.classList.remove("hidden");
  newModal.classList.add("flex");
  
  // Update modal z-indexes
  updateModalZIndexes();

  return {
    path: path,
    element: newModal,
    title: newModal.querySelector(".modal-title"),
    body: newModal.querySelector(".modal-bd"),
    close: close_button,
    footerSlot: newModal.querySelector(".modal-footer-slot"),
    inner: newModal.querySelector(".relative.w-full"), // Updated selector for inner
    styles: [],
    scripts: [],
  };
}

// Function to open modal with content from URL
export function openModal(modalPath) {
  return new Promise((resolve) => {
    try {
      // Create new modal instance
      const modal = createModalElement(modalPath);

      new MutationObserver(
        (_, o) =>
          !document.contains(modal.element) && (o.disconnect(), resolve())
      ).observe(document.body, { childList: true, subtree: true });

      // Set a loading state
      modal.body.innerHTML = '<div class="flex items-center justify-center p-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>';

      // Already added to stack above

      // Use importComponent to load the modal content
      // This handles all HTML, styles, scripts and nested components
      // Updated path to use the new folder structure with modal.html
      const componentPath = modalPath; // `modals/${modalPath}/modal.html`;

      // Use importComponent which now returns the parsed document
      importComponent(componentPath, modal.body)
        .then((doc) => {
          // Set the title from the document
          modal.title.innerHTML = doc.title || modalPath;
          if (doc.html && doc.html.classList) {
            const inner = modal.element.querySelector(".relative.w-full");
            if (inner) inner.classList.add(...doc.html.classList);
          }
          if (doc.body && doc.body.classList) {
            modal.body.classList.add(...doc.body.classList);
          }
          
          // Some modals have a footer. Check if it exists and move it to footer slot
          // Use requestAnimationFrame to let Alpine mount the component first
          requestAnimationFrame(() => {
            const componentFooter = modal.body.querySelector('[data-modal-footer]');
            if (componentFooter && modal.footerSlot) {
              // Move footer outside modal-scroll scrollable area
              modal.footerSlot.appendChild(componentFooter);
              modal.footerSlot.classList.remove('hidden');
              modal.footerSlot.style.display = 'block'; // Ensure display block if specific styles needed
              // modal.inner.classList.add('modal-with-footer'); // No longer needed with flex col layout
            }
          });
        })
        .catch((error) => {
          console.error("Error loading modal content:", error);
          modal.body.innerHTML = `<div class="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50 dark:bg-gray-800 dark:text-red-400">Failed to load modal content: ${error.message}</div>`;
        });

      // Add modal to stack and show it
      // Add modal to stack
      modal.path = modalPath;
      modalStack.push(modal);
      modal.element.classList.remove("hidden");
      modal.element.classList.add("flex");
      document.body.style.overflow = "hidden";

      // Update modal z-indexes
      updateModalZIndexes();
    } catch (error) {
      console.error("Error loading modal content:", error);
      resolve();
    }
  });
}

// Function to close modal
export function closeModal(modalPath = null) {
  if (modalStack.length === 0) return;

  let modalIndex = modalStack.length - 1; // Default to last modal
  let modal;

  if (modalPath) {
    // Find the modal with the specified name in the stack
    modalIndex = modalStack.findIndex((modal) => modal.path === modalPath);
    if (modalIndex === -1) return; // Modal not found in stack

    // Get the modal from stack at the found index
    modal = modalStack[modalIndex];
    // Remove the modal from stack
    modalStack.splice(modalIndex, 1);
  } else {
    // Just remove the last modal
    modal = modalStack.pop();
  }

  // Remove modal-specific styles and scripts immediately
  modal.styles.forEach((styleId) => {
    document.querySelector(`[data-modal-style="${styleId}"]`)?.remove();
  });
  modal.scripts.forEach((scriptId) => {
    document.querySelector(`[data-modal-script="${scriptId}"]`)?.remove();
  });

  // First remove the show class to trigger the transition
  modal.element.classList.remove("flex");
  modal.element.classList.add("hidden");

  // remove immediately
  if (modal.element.parentNode) {
    modal.element.parentNode.removeChild(modal.element);
  }


  // Handle backdrop visibility and body overflow
  if (modalStack.length === 0) {
    // Hide backdrop when no modals are left
    backdrop.style.display = "none";
    document.body.style.overflow = "";
  } else {
    // Update modal z-indexes
    updateModalZIndexes();
  }
}

// Function to scroll to element by ID within the last modal
export function scrollModal(id) {
  if (!id) return;

  // Get the last modal in the stack
  const lastModal = modalStack[modalStack.length - 1].element;
  if (!lastModal) return;

  // Find the modal container and target element
  const modalContainer = lastModal.querySelector(".modal-scroll");
  const targetElement = lastModal.querySelector(`#${id}`);

  if (modalContainer && targetElement) {
    modalContainer.scrollTo({
      top: targetElement.offsetTop - 20, // 20px padding from top
      behavior: "smooth",
    });
  }
}

// Make scrollModal globally available
globalThis.scrollModal = scrollModal;

// Handle modal content loading from clicks
document.addEventListener("click", async (e) => {
  const modalTrigger = e.target.closest("[data-modal-content]");
  if (modalTrigger) {
    e.preventDefault();
    if (
      modalTrigger.hasAttribute("disabled") ||
      modalTrigger.classList.contains("disabled")
    ) {
      return;
    }
    const modalPath = modalTrigger.getAttribute("href");
    await openModal(modalPath);
  }
});

// Close modal on escape key (closes only the top modal)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalStack.length > 0) {
    closeModal();
  }
});

// also export as global function
globalThis.openModal = openModal;
globalThis.closeModal = closeModal;
globalThis.scrollModal = scrollModal;
