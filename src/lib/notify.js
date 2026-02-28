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

export async function success(message, title = 'Success') {
    return fire({ icon: 'success', title, text: message });
}

export async function info(message, title = 'Information') {
    return fire({ icon: 'info', title, text: message });
}

export async function warn(message, title = 'Warning') {
    return fire({ icon: 'warning', title, text: message });
}

export async function error(message, title = 'Error') {
    return fire({ icon: 'error', title, text: message });
}

export async function confirm(message, options = {}) {
    const result = await fire({
        icon: options.icon || 'warning',
        title: options.title || 'Please Confirm',
        text: message,
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
