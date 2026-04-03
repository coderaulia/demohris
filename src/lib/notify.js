import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

const defaults = {
    confirmButtonText: 'OK',
    heightAuto: false,
    allowOutsideClick: true,
    allowEscapeKey: true,
};

function fire(options = {}) {
    return Swal.fire({ ...defaults, ...options });
}

const toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2800,
    timerProgressBar: true,
    heightAuto: false,
});

export async function success(message, title = 'Success') {
    toast.fire({ icon: 'success', title, text: message });
    return true;
}

export async function info(message, title = 'Information') {
    toast.fire({ icon: 'info', title, text: message });
    return true;
}

export async function warn(message, title = 'Warning') {
    toast.fire({ icon: 'warning', title, text: message });
    return true;
}

export async function error(message, title = 'Error') {
    toast.fire({ icon: 'error', title, text: message, timer: 4500 });
    return true;
}

export async function confirm(message, options = {}) {
    const result = await fire({
        icon: options.icon || 'warning',
        title: options.title || 'Please Confirm',
        text: options.html ? undefined : message,
        html: options.html || undefined,
        showCancelButton: true,
        confirmButtonText: options.confirmButtonText || 'Yes',
        cancelButtonText: options.cancelButtonText || 'Cancel',
        reverseButtons: true,
        focusCancel: true,
    });
    return result.isConfirmed;
}

export async function input(options = {}) {
    const result = await fire({
        title: options.title || 'Input Required',
        text: options.text || '',
        input: options.input || 'text',
        inputOptions: options.inputOptions,
        inputValue: options.inputValue ?? '',
        inputPlaceholder: options.inputPlaceholder || '',
        inputLabel: options.inputLabel || '',
        inputAttributes: options.inputAttributes || {},
        showCancelButton: true,
        confirmButtonText: options.confirmButtonText || 'Save',
        cancelButtonText: options.cancelButtonText || 'Cancel',
        showLoaderOnConfirm: Boolean(options.showLoaderOnConfirm),
        preConfirm: value => {
            if (typeof options.validate === 'function') {
                const msg = options.validate(value);
                if (msg) {
                    Swal.showValidationMessage(msg);
                    return false;
                }
            }
            return value;
        },
    });

    if (!result.isConfirmed) return null;
    return result.value;
}

export function showLoading(title = 'Please wait...', text = 'Processing request...') {
    Swal.fire({
        title,
        text,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        },
    });
}

export function hideLoading() {
    Swal.close();
}

export function close() {
    Swal.close();
}

export async function withLoading(task, title = 'Please wait...', text = 'Processing request...') {
    showLoading(title, text);
    try {
        return await task();
    } finally {
        hideLoading();
    }
}

export function showValidationMessage(message) {
    Swal.showValidationMessage(message);
}

export async function prompt(options = {}) {
    const result = await fire({
        title: options.title || 'Input Required',
        html: options.html || '',
        input: options.input || 'text',
        inputOptions: options.inputOptions,
        inputValue: options.inputValue ?? '',
        inputPlaceholder: options.inputPlaceholder || '',
        inputLabel: options.inputLabel || '',
        inputAttributes: options.inputAttributes || {},
        showCancelButton: true,
        confirmButtonText: options.confirmButtonText || 'OK',
        cancelButtonText: options.cancelButtonText || 'Cancel',
        showLoaderOnConfirm: Boolean(options.showLoaderOnConfirm),
        reverseButtons: true,
        focusCancel: true,
        preConfirm: value => {
            if (typeof options.preConfirm === 'function') {
                const result = options.preConfirm();
                if (result === false) {
                    return false;
                }
                if (result.then) {
                    return result.then(r => r === false ? false : r).catch(() => false);
                }
                return result;
            }
            if (typeof options.validate === 'function') {
                const msg = options.validate(value);
                if (msg) {
                    Swal.showValidationMessage(msg);
                    return false;
                }
            }
            return value;
        },
    });

    if (!result.isConfirmed) return null;
    return result.value;
}
