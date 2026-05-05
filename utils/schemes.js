const SCHEME_NAMES = Object.freeze({
    IFFCO_TOKIO: 'IFFCO TOKIO',
    NSF: 'NSF',
    FFE: 'FFE',
    PRIF: 'PRIF',
});

const SCHEME_LIST = Object.freeze(Object.values(SCHEME_NAMES));

module.exports = { SCHEME_NAMES, SCHEME_LIST };
