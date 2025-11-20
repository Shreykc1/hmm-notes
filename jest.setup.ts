import '@testing-library/jest-dom';

// Mock Web Crypto API for Jest
const crypto = {
    getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) {
            arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    },
    subtle: {
        generateKey: jest.fn(),
        encrypt: jest.fn(),
        decrypt: jest.fn(),
        deriveBits: jest.fn(),
        deriveKey: jest.fn(),
        importKey: jest.fn(),
        exportKey: jest.fn(),
        wrapKey: jest.fn(),
        unwrapKey: jest.fn(),
        sign: jest.fn(),
        verify: jest.fn(),
    },
};

Object.defineProperty(global, 'crypto', {
    value: crypto,
});
