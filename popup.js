document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const textNoteList = document.getElementById('textNoteList');
  const imageNoteList = document.getElementById('imageNoteList');
  const customContextMenu = document.getElementById('customContextMenu');
  const contextMenuList = document.getElementById('contextMenuList');
  const toast = document.getElementById('toast');

  const createNoteBtn = document.getElementById('createNoteBtn');
  const newNoteContainer = document.getElementById('newNoteContainer');
  const newNoteText = document.getElementById('newNoteText');
  const saveNewNoteBtn = document.getElementById('saveNewNoteBtn');
  const cancelNewNoteBtn = document.getElementById('cancelNewNoteBtn');
  const textTabBtn = document.getElementById('textTabBtn');
  const imageTabBtn = document.getElementById('imageTabBtn');
  const textTab = document.getElementById('textTab');
  const imageTab = document.getElementById('imageTab');
  const deleteModal = document.getElementById('deleteModal');
  const deleteMessage = document.getElementById('deleteMessage');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const importJsonBtn = document.getElementById('importJsonBtn');
  const fileInput = document.getElementById('fileInput');
  const importChoiceModal = document.getElementById('importChoiceModal');
  const addImportBtn = document.getElementById('addImportBtn');
  const replaceImportBtn = document.getElementById('replaceImportBtn');

  let allNotes = [];
  let selectedNoteIndexes = new Set();
  let currentContextNoteIndex = null;
  let currentEditingIndex = null;
  let pendingImportNotes = null;

  // Hàm áp dụng i18n cho text tĩnh trong DOM
  function applyI18n() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const msgName = el.getAttribute('data-i18n');
      const msg = chrome.i18n.getMessage(msgName);
      if(msg) el.textContent = msg;
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const msgName = el.getAttribute('data-i18n-placeholder');
      const msg = chrome.i18n.getMessage(msgName);
      if(msg) el.setAttribute('placeholder', msg);
    });
    deleteMessage.textContent = chrome.i18n.getMessage('deleteConfirm');
    importChoiceModal.querySelector('p').textContent = chrome.i18n.getMessage('importChoiceTitle');
    addImportBtn.textContent = chrome.i18n.getMessage('addButton');
    replaceImportBtn.textContent = chrome.i18n.getMessage('replaceButton');
  }

  // Render notes list
  function renderNotes(notes) {
    allNotes = notes;
    textNoteList.innerHTML = '';
    imageNoteList.innerHTML = '';

    notes.forEach((note, index) => {
      const li = document.createElement('li');
      li.classList.add('note-item', 'fade-in');
      li.dataset.index = index;
      li.dataset.type = note.text ? 'text' : 'image';

      if (selectedNoteIndexes.has(index)) {
        li.classList.add('selected-multi');
      } else {
        li.classList.remove('selected-multi');
      }

      const content = document.createElement('div');
      content.className = 'note-content';

      const timestampDiv = document.createElement('div');
      timestampDiv.className = 'timestamp';
      timestampDiv.innerHTML = `<span class="date">${note.time || ''}</span>`;

      content.appendChild(timestampDiv);

      if (note.text) {
        if (currentEditingIndex === index) {
          renderInlineEdit(note.text, content, index);
        } else {
          const textDiv = document.createElement('div');
          textDiv.className = 'text-content';
          textDiv.innerHTML = note.text.replace(/\n/g, '<br>');
          content.appendChild(textDiv);
        }
        textNoteList.appendChild(li);
      } else if (note.image) {
        const img = document.createElement('img');
        img.src = note.image;
        img.className = 'note-image';
        content.appendChild(img);
        imageNoteList.appendChild(li);
      }

      li.appendChild(content);

      // Click trái toggle chọn nhiều ghi chú
      li.addEventListener('click', (e) => {
        if (currentEditingIndex !== null) return;
        e.preventDefault();
        if (selectedNoteIndexes.has(index)) {
          selectedNoteIndexes.delete(index);
          li.classList.remove('selected-multi');
        } else {
          selectedNoteIndexes.add(index);
          li.classList.add('selected-multi');
        }
        hideContextMenu();
      });

      // Chuột phải hiện menu
      li.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  currentContextNoteIndex = index;

  // Kiểm tra nếu ghi chú không được chọn (chưa bôi xanh), không cho phép mở menu ngữ cảnh
  if (!selectedNoteIndexes.has(index)) {
    return; // Nếu ghi chú chưa được chọn, không thực hiện gì
  }

  const isSelected = selectedNoteIndexes.has(index);

  if (note.image) {
    showImageContextMenu(e.pageX, e.pageY, index);
  } else {
    showTextContextMenu(e.pageX, e.pageY, isSelected);
  }
});

    });
  }

  // Menu chuột phải cho ảnh (Xóa + Lưu ảnh)
  function showImageContextMenu(x, y, index) {
    contextMenuList.innerHTML = '';

    const deleteLi = document.createElement('li');
    deleteLi.textContent = chrome.i18n.getMessage('deleteButton');
    deleteLi.addEventListener('click', () => {
      if (selectedNoteIndexes.size > 0 && selectedNoteIndexes.has(index)) {
        // Xóa tất cả ảnh được chọn
        const indexesToDelete = Array.from(selectedNoteIndexes).sort((a, b) => b - a);
        indexesToDelete.forEach(idx => {
          allNotes.splice(idx, 1);
        });
        selectedNoteIndexes.clear();
      } else {
        allNotes.splice(index, 1);
      }
      currentEditingIndex = null;
      chrome.storage.local.set({ notes: allNotes }, () => {
        renderNotes(allNotes);
        showToast(chrome.i18n.getMessage('deleteSuccess'));
      });
      hideContextMenu();
    });

    const saveLi = document.createElement('li');
    saveLi.textContent = chrome.i18n.getMessage("saveImageOption"); // Thay thế bằng i18n
    saveLi.addEventListener('click', () => {
      const imgSrc = allNotes[index].image;
      if (imgSrc) {
        const a = document.createElement('a');
        a.href = imgSrc;
        a.download = `note_image_${index}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast(chrome.i18n.getMessage("imageSaveSuccess")); // Thay thế bằng i18n
      }
      hideContextMenu();
    });

    contextMenuList.appendChild(deleteLi);
    contextMenuList.appendChild(saveLi);

    customContextMenu.style.top = y + 'px';
    customContextMenu.style.left = x + 'px';
    customContextMenu.style.display = 'block';

    const rect = customContextMenu.getBoundingClientRect();
    const popupRect = document.body.getBoundingClientRect();
    if (rect.right > popupRect.right) {
      customContextMenu.style.left = (x - (rect.right - popupRect.right)) + 'px';
    }
    if (rect.bottom > popupRect.bottom) {
      customContextMenu.style.top = (y - (rect.bottom - popupRect.bottom)) + 'px';
    }
  }

  // Menu chuột phải cho text (tuỳ theo số ghi chú được chọn)
  function showTextContextMenu(x, y, isSelected) {
    contextMenuList.innerHTML = '';

    let options = [];

    if (selectedNoteIndexes.size > 1) {
      options = [chrome.i18n.getMessage('copyButton'), chrome.i18n.getMessage('deleteButton')];
    } else if (selectedNoteIndexes.size === 1 && isSelected) {
      options = [chrome.i18n.getMessage('copyButton'), chrome.i18n.getMessage('editButton'), chrome.i18n.getMessage('deleteButton')];
    } else {
      options = [chrome.i18n.getMessage('copyButton'), chrome.i18n.getMessage('editButton'), chrome.i18n.getMessage('deleteButton')];
    }

    options.forEach(option => {
      const li = document.createElement('li');
      li.textContent = option;
      li.addEventListener('click', () => {
        handleContextMenuOption(option);
        hideContextMenu();
      });
      contextMenuList.appendChild(li);
    });

    customContextMenu.style.top = y + 'px';
    customContextMenu.style.left = x + 'px';
    customContextMenu.style.display = 'block';

    const rect = customContextMenu.getBoundingClientRect();
    const popupRect = document.body.getBoundingClientRect();
    if (rect.right > popupRect.right) {
      customContextMenu.style.left = (x - (rect.right - popupRect.right)) + 'px';
    }
    if (rect.bottom > popupRect.bottom) {
      customContextMenu.style.top = (y - (rect.bottom - popupRect.bottom)) + 'px';
    }
  }

  function hideContextMenu() {
    customContextMenu.style.display = 'none';
  }

  // Xử lý menu chọn
  function handleContextMenuOption(option) {
    if (currentContextNoteIndex === null) return;

    if (option === chrome.i18n.getMessage('copyButton')) {
      if (selectedNoteIndexes.size > 0 && selectedNoteIndexes.has(currentContextNoteIndex)) {
        const texts = [];
        selectedNoteIndexes.forEach(idx => {
          const note = allNotes[idx];
          if (note.text) texts.push(note.text);
        });
        if (texts.length === 0) {
          showToast(chrome.i18n.getMessage('noTextToCopy'));
          return;
        }
        const combinedText = texts.join('\n\n');
        navigator.clipboard.writeText(combinedText).then(() => {
          showToast(chrome.i18n.getMessage('copyMultiSuccess').replace('{num}', texts.length));
        });
      } else {
        const note = allNotes[currentContextNoteIndex];
        if (note.text) {
          navigator.clipboard.writeText(note.text).then(() => {
            showToast(chrome.i18n.getMessage('copySuccess'));
          });
        }
      }
    } else if (option === chrome.i18n.getMessage('editButton')) {
      currentEditingIndex = currentContextNoteIndex;
      renderNotes(allNotes);
    } else if (option === chrome.i18n.getMessage('deleteButton')) {
      if (selectedNoteIndexes.size > 0 && selectedNoteIndexes.has(currentContextNoteIndex)) {
        const indexesToDelete = Array.from(selectedNoteIndexes).sort((a,b) => b - a);
        indexesToDelete.forEach(idx => {
          allNotes.splice(idx,1);
        });
        selectedNoteIndexes.clear();
        currentEditingIndex = null;
        chrome.storage.local.set({ notes: allNotes }, () => {
          renderNotes(allNotes);
          showToast(chrome.i18n.getMessage('deleteSuccess'));
        });
      } else {
        openDeleteModal(currentContextNoteIndex);
      }
    }
  }

  // Inline chỉnh sửa
  function renderInlineEdit(text, container, index) {
    container.innerHTML = '';
    const textarea = document.createElement('textarea');
    textarea.className = 'edit-textarea';
    textarea.value = text;

    const btnContainer = document.createElement('div');
    btnContainer.className = 'edit-button-container';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-button';
    saveBtn.textContent = chrome.i18n.getMessage('saveButton');

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-button';
    cancelBtn.textContent = chrome.i18n.getMessage('cancelButton');

    btnContainer.appendChild(saveBtn);
    btnContainer.appendChild(cancelBtn);

    container.appendChild(textarea);
    container.appendChild(btnContainer);

    textarea.focus();

    saveBtn.onclick = () => {
      const newText = textarea.value.trim();
      if (newText) {
        allNotes[index].text = newText;
        currentEditingIndex = null;
        selectedNoteIndexes.clear();
        chrome.storage.local.set({ notes: allNotes }, () => {
          renderNotes(allNotes);
          showToast(chrome.i18n.getMessage('saveSuccess'));
        });
      }
    };

    cancelBtn.onclick = () => {
      currentEditingIndex = null;
      renderNotes(allNotes);
    };
  }

  // Modal xác nhận xóa
  function openDeleteModal(index) {
    deleteModal.style.display = 'flex';

    confirmDeleteBtn.textContent = chrome.i18n.getMessage('deleteButton');
    cancelDeleteBtn.textContent = chrome.i18n.getMessage('cancelButton');

    confirmDeleteBtn.onclick = () => {
      allNotes.splice(index, 1);
      selectedNoteIndexes.delete(index);
      currentEditingIndex = null;
      chrome.storage.local.set({ notes: allNotes }, () => {
        renderNotes(allNotes);
        deleteModal.style.display = 'none';
        showToast(chrome.i18n.getMessage('deleteSuccess'));
      });
    };

    cancelDeleteBtn.onclick = () => {
      deleteModal.style.display = 'none';
    };
  }

  // Toast hiển thị thông báo
  let toastTimeout;
  function showToast(message) {
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.style.display = 'none';
    }, 1500);
  }

  // Ẩn menu khi click ngoài
  document.addEventListener('click', () => {
    hideContextMenu();
  });

  // Chuyển tab văn bản/ảnh
  textTabBtn.addEventListener('click', () => {
    textTabBtn.classList.add('active');
    imageTabBtn.classList.remove('active');
    textTab.classList.add('active');
    imageTab.classList.remove('active');
  });

  imageTabBtn.addEventListener('click', () => {
    imageTabBtn.classList.add('active');
    textTabBtn.classList.remove('active');
    imageTab.classList.add('active');
    textTab.classList.remove('active');
  });

  // Tạo ghi chú mới
  createNoteBtn.addEventListener('click', () => {
    newNoteContainer.style.display = 'block';
    newNoteText.value = '';
    newNoteText.focus();
  });

  saveNewNoteBtn.addEventListener('click', () => {
    const text = newNoteText.value.trim();
    if (text) {
      const now = new Date();
      const formattedTime = now.toLocaleDateString('vi-VN') + ' [ ' + now.toLocaleTimeString('vi-VN') + ' ]';
      allNotes.unshift({ text, time: formattedTime });
      chrome.storage.local.set({ notes: allNotes }, () => {
        renderNotes(allNotes);
        newNoteText.value = '';
        newNoteContainer.style.display = 'none';
        showToast(chrome.i18n.getMessage('createSuccess'));
      });
    }
  });

  cancelNewNoteBtn.addEventListener('click', () => {
    newNoteText.value = '';
    newNoteContainer.style.display = 'none';
  });

  // Xuất JSON
  exportJsonBtn.addEventListener('click', () => {
    if (!allNotes.length) {
      alert(chrome.i18n.getMessage('jsonExportNoNotes'));
      return;
    }
    const dataStr = JSON.stringify(allNotes, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `notes_backup_${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  });

  // Import JSON với modal chọn thêm/thay thế
  importJsonBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedNotes = JSON.parse(e.target.result);
        if (!Array.isArray(importedNotes)) throw new Error(chrome.i18n.getMessage('jsonImportInvalidFile'));

        const isValid = importedNotes.every(note =>
          (typeof note === 'object') &&
          (('text' in note) || ('image' in note)) &&
          ('time' in note)
        );
        if (!isValid) throw new Error(chrome.i18n.getMessage('jsonImportInvalidFile'));

        pendingImportNotes = importedNotes;
        importChoiceModal.style.display = 'flex';

      } catch (error) {
        alert(chrome.i18n.getMessage('jsonImportInvalidFile') + ': ' + error.message);
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  addImportBtn.addEventListener('click', () => {
    if (!pendingImportNotes) return;
    allNotes = pendingImportNotes.concat(allNotes);
    chrome.storage.local.set({ notes: allNotes }, () => {
      renderNotes(allNotes);
      showToast(chrome.i18n.getMessage('jsonImportAddSuccess'));
      pendingImportNotes = null;
      importChoiceModal.style.display = 'none';
    });
  });

  replaceImportBtn.addEventListener('click', () => {
    if (!pendingImportNotes) return;
    allNotes = pendingImportNotes;
    chrome.storage.local.set({ notes: allNotes }, () => {
      renderNotes(allNotes);
      showToast(chrome.i18n.getMessage('jsonImportReplaceSuccess'));
      pendingImportNotes = null;
      importChoiceModal.style.display = 'none';
    });
  });

  // Khởi tạo dữ liệu và gọi i18n
  chrome.storage.local.get({ notes: [] }, (data) => {
    renderNotes(data.notes);
    applyI18n();
  });

  function hideContextMenu() {
    customContextMenu.style.display = 'none';
  }
});
