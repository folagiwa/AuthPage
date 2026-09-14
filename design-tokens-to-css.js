/**
 * =============================================================================
 * design-tokens-to-css.js
 * =============================================================================
 *
 * PURPOSE
 * -------
 * Converts the Figma design token JSON file (`design-tokens.tokens.json`) into
 * a single, well-organised CSS file (`design-tokens.css`) containing CSS custom
 * properties (CSS variables) for every token category in the design system.
 *
 * DESIGN SYSTEM OVERVIEW
 * ----------------------
 * The token file follows a Material Design 3-inspired architecture with a clear
 * two-layer colour strategy:
 *
 *  1. PRIMITIVE COLORS (reference / foundation layer)
 *     ─────────────────────────────────────────────────
 *     Raw colour palettes (e.g. primary0–primary100, neutral0–neutral100).
 *     These are the building blocks and should NEVER be used directly in UI
 *     component code.  They live under the `[data-layer="primitive"]` selector
 *     so they are technically available but visually separated.
 *
 *  2. COLOR ROLES (semantic / decision layer)
 *     ─────────────────────────────────────────
 *     Named semantic slots (e.g. `--color-primary`, `--color-on-primary`,
 *     `--color-surface`).  These are what components should reference.  Each
 *     role resolves to a primitive via `{primitive colors.…}` references in the
 *     source JSON.  The script resolves these references to their concrete hex
 *     values so the output CSS is dependency-free.
 *
 * OUTPUT SECTIONS (in order)
 * --------------------------
 *   :root  ─ Effects (shadows)
 *   :root  ─ PRIMITIVE COLORS (commented as reference-only)
 *   :root  ─ COLOR ROLES  (the colours to use in UI)
 *   :root  ─ Spacing scale
 *   :root  ─ Typography scale
 *
 * NAMING CONVENTION
 * -----------------
 *   Token names are converted to kebab-case CSS variable names:
 *     "soft shadow"             → --effect-soft-shadow
 *     "primary key color"       → --primitive-key-primary-key-color
 *     "primary"                 → --color-primary
 *     "on primary container"    → --color-on-primary-container
 *     "base spacing"            → --spacing-base
 *     "display large / fontSize"→ --type-display-large-font-size
 *
 * USAGE
 * -----
 *   node design-tokens-to-css.js
 *
 *   Input  : design-tokens.tokens.json  (must be in the same directory)
 *   Output : design-tokens.css          (written to the same directory)
 *
 * REQUIREMENTS
 * ------------
 *   Node.js >= 14  (uses fs.readFileSync / fs.writeFileSync, no extra packages)
 *
 * =============================================================================
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// 1. CONFIGURATION
// ---------------------------------------------------------------------------

/** Absolute path of this script's directory – used for sibling file I/O. */
const DIR = __dirname;

const INPUT_FILE  = path.join(DIR, 'design-tokens.tokens.json');
const OUTPUT_FILE = path.join(DIR, 'design-tokens.css');

// ---------------------------------------------------------------------------
// 2. UTILITIES
// ---------------------------------------------------------------------------

/**
 * Converts a human-readable token name (possibly with spaces) to a CSS-safe
 * kebab-case string.
 *
 * @param  {string} name - e.g. "on primary container"
 * @returns {string}      - e.g. "on-primary-container"
 */
function toKebabCase(name) {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')         // spaces -> hyphens
    .replace(/[^a-z0-9-]/g, '-') // any non-alphanumeric -> hyphen
    .replace(/-{2,}/g, '-')      // collapse consecutive hyphens
    .replace(/^-|-$/g, '');      // strip leading / trailing hyphens
}

/**
 * Strips the trailing alpha channel from an 8-digit Figma hex colour so that
 * the output is the standard 6-digit hex used in CSS.
 *
 * Figma exports colours as `#rrggbbaa` where `ff` = fully opaque.
 * CSS only accepts 8-digit hex for colours that include alpha, but for fully
 * opaque colours the 6-digit form is preferable for readability.
 *
 * If the alpha channel is not `ff` the full rgba() notation is returned
 * instead so that transparency is not lost.
 *
 * @param  {string} hex - e.g. "#2563ebff" or "#0000001f"
 * @returns {string}     - e.g. "#2563eb"  or "rgba(0,0,0,0.12)"
 */
function normaliseColor(hex) {
  if (typeof hex !== 'string' || !hex.startsWith('#')) return hex;

  const clean = hex.replace('#', '');

  // Standard 6-digit hex — return as-is.
  if (clean.length === 6) return '#' + clean;

  // 8-digit hex (Figma's rrggbbaa format).
  if (clean.length === 8) {
    const alpha = clean.slice(6, 8).toLowerCase();
    if (alpha === 'ff') {
      // Fully opaque — drop the alpha channel.
      return '#' + clean.slice(0, 6);
    }
    // Partially transparent — convert to rgba() for CSS compatibility.
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    const a = (parseInt(alpha, 16) / 255).toFixed(2);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + a + ')';
  }

  return hex; // Unexpected format – return unchanged.
}

/**
 * Resolves a Figma token reference string (e.g. `{primitive colors.primary
 * color pallete.primary90}`) to its concrete hex value by walking the token
 * tree.
 *
 * Reference syntax used in the source JSON:
 *   {group.subgroup.tokenName}
 *
 * @param  {string} ref    - The raw reference string including curly braces.
 * @param  {object} tokens - The full parsed token JSON object.
 * @returns {string}        - The resolved & normalised colour value, or the
 *                            original reference string if resolution fails.
 */
function resolveReference(ref, tokens) {
  // Strip surrounding braces and split into path parts.
  const inner = ref.replace(/^\{|\}$/g, '');
  const parts  = inner.split('.');

  let node = tokens;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in node) {
      node = node[part];
    } else {
      // Reference path could not be walked – return original.
      console.warn('  WARNING: Could not resolve reference: ' + ref);
      return ref;
    }
  }

  // The resolved node should have a `value` property.
  if (node && typeof node.value === 'string') {
    // The resolved value might itself be a reference (chained references).
    if (node.value.startsWith('{')) {
      return resolveReference(node.value, tokens);
    }
    return normaliseColor(node.value);
  }

  console.warn('  WARNING: Resolved node has no string value for: ' + ref);
  return ref;
}

/**
 * Wraps a block of CSS variables in a well-commented section header for
 * readability in the output file.
 *
 * @param  {string} title   - Section heading text.
 * @param  {string} content - The CSS variable declarations.
 * @param  {string} [note]  - Optional explanatory note shown below the title.
 * @returns {string}
 */
function section(title, content, note) {
  const bar = '='.repeat(72);
  const noteBlock = note
    ? '\n   *\n   * NOTE: ' + note
    : '';

  return '\n  /* ' + bar + '\n   * ' + title + noteBlock + '\n   * ' + bar + ' */\n' + content;
}

// ---------------------------------------------------------------------------
// 3. TOKEN -> CSS-VARIABLE CONVERTERS
// ---------------------------------------------------------------------------

/**
 * Converts a `custom-shadow` effect token into a CSS `box-shadow` value
 * string and emits a CSS custom property for it.
 *
 * @param  {string} name  - Token name, e.g. "soft shadow".
 * @param  {object} token - The token object from the JSON.
 * @returns {string}       - A single CSS variable declaration line.
 */
function convertEffect(name, token) {
  const v = token.value;

  if (token.type === 'custom-shadow') {
    const color  = normaliseColor(v.color);
    const shadow = v.offsetX + 'px ' + v.offsetY + 'px ' + v.radius + 'px ' + v.spread + 'px ' + color;
    return '  --effect-' + toKebabCase(name) + ': ' + shadow + ';';
  }

  // Fall-through for unknown effect types.
  return '  /* Unsupported effect type "' + token.type + '" for "' + name + '" */';
}

/**
 * Converts a flat collection of primitive colour tokens (from one palette
 * sub-group) into CSS custom property declarations.
 *
 * Primitive colour variable names include the palette prefix so there is no
 * ambiguity when reading the generated CSS:
 *   --primitive-<palette>-<shade>
 *
 * @param  {string} paletteName - e.g. "primary color pallete"
 * @param  {object} palette     - Map of shade name -> token object.
 * @returns {string[]}           - Array of CSS declaration lines.
 */
function convertPrimitivePalette(paletteName, palette) {
  const prefix = toKebabCase(paletteName);
  return Object.entries(palette).map(function(entry) {
    const shade = entry[0];
    const token = entry[1];
    if (!token || typeof token.value !== 'string') return '';
    const colour = normaliseColor(token.value);
    return '  --primitive-' + prefix + '-' + toKebabCase(shade) + ': ' + colour + ';';
  }).filter(Boolean);
}

/**
 * Converts a colour-role token into a CSS custom property declaration.
 *
 * Colour roles reference primitive colours (resolved at build time) and are
 * the ONLY colours that should be consumed by UI components.
 *
 * @param  {string} roleName  - e.g. "on primary container"
 * @param  {object} token     - The token object (value may be a reference string).
 * @param  {object} allTokens - Full token JSON (used for reference resolution).
 * @returns {string}           - A single CSS variable declaration line.
 */
function convertColorRole(roleName, token, allTokens) {
  let value = token.value;

  // Resolve {reference} syntax to a concrete hex value.
  if (typeof value === 'string' && value.startsWith('{')) {
    value = resolveReference(value, allTokens);
  } else {
    value = normaliseColor(value);
  }

  return '  --color-' + toKebabCase(roleName) + ': ' + value + ';';
}

/**
 * Converts a spacing-scale token into a CSS custom property.
 *
 * All spacing values are emitted in `px` (as stored in the JSON).
 *
 * @param  {string} name  - e.g. "base spacing"
 * @param  {object} token - The token object.
 * @returns {string}
 */
function convertSpacing(name, token) {
  const value = token.value;
  const px    = typeof value === 'number' ? value + 'px' : value;
  return '  --spacing-' + toKebabCase(name) + ': ' + px + ';';
}

/**
 * Converts a composite typography token into a set of CSS custom properties,
 * one for each typographic attribute.
 *
 * Each property is namespaced with the scale name so they can be accessed
 * individually:
 *   --type-<scale>-font-size
 *   --type-<scale>-font-family
 *   --type-<scale>-font-weight
 *   --type-<scale>-line-height
 *   --type-<scale>-letter-spacing
 *   --type-<scale>-font-style
 *   --type-<scale>-text-decoration
 *   --type-<scale>-text-case
 *
 * Dimension values (fontSize, lineHeight, letterSpacing) are output in `px`.
 *
 * @param  {string} scaleName - e.g. "display large"
 * @param  {object} token     - The composite typography token object.
 * @returns {string[]}         - Array of CSS declaration lines.
 */
function convertTypography(scaleName, token) {
  const prefix = '--type-' + toKebabCase(scaleName);
  const lines  = [];

  /**
   * Helper: pushes a declaration only if the token sub-property is present
   * and has a meaningful value.
   *
   * @param {string}   cssProp  - CSS property suffix, e.g. "font-size".
   * @param {string}   tokenKey - Key in the token object, e.g. "fontSize".
   * @param {Function} [format] - Optional value formatter.
   */
  function push(cssProp, tokenKey, format) {
    const sub = token[tokenKey];
    if (sub === undefined || sub === null) return;
    const raw = (typeof sub === 'object' && 'value' in sub) ? sub.value : sub;
    if (raw === undefined || raw === null || raw === '') return;
    const formatted = format ? format(raw) : raw;
    lines.push('  ' + prefix + '-' + cssProp + ': ' + formatted + ';');
  }

  push('font-size',       'fontSize',       function(v) { return v + 'px'; });
  push('font-family',     'fontFamily',     function(v) { return '"' + v + '", sans-serif'; });
  push('font-weight',     'fontWeight');
  push('font-style',      'fontStyle');
  push('line-height',     'lineHeight',     function(v) { return v + 'px'; });
  push('letter-spacing',  'letterSpacing',  function(v) { return v + 'px'; });
  push('text-decoration', 'textDecoration');
  push('text-transform',  'textCase',       function(v) { return v === 'none' ? 'none' : v; });

  return lines;
}

// ---------------------------------------------------------------------------
// 4. MAIN GENERATION FUNCTION
// ---------------------------------------------------------------------------

/**
 * Entry point.  Reads the design token JSON, orchestrates conversion of each
 * token category, and writes the resulting CSS to disk.
 */
function generateCSS() {
  // ------------------------------------------------------------------
  // 4.1  Read + parse source JSON
  // ------------------------------------------------------------------
  console.log('\nReading: ' + INPUT_FILE);
  var tokens;
  try {
    var raw = fs.readFileSync(INPUT_FILE, 'utf8');
    tokens = JSON.parse(raw);
  } catch (err) {
    console.error('\nFailed to read / parse input file:\n   ' + err.message);
    process.exit(1);
  }
  console.log('   Parsed successfully.');

  var outputLines = [];

  // ------------------------------------------------------------------
  // 4.2  File header
  // ------------------------------------------------------------------
  outputLines.push(
    '/**\n' +
    ' * design-tokens.css\n' +
    ' * Auto-generated by design-tokens-to-css.js – DO NOT EDIT MANUALLY.\n' +
    ' *\n' +
    ' * Generated: ' + new Date().toISOString() + '\n' +
    ' *\n' +
    ' * ─────────────────────────────────────────────────────────────────────────────\n' +
    ' * COLOR ARCHITECTURE – READ BEFORE USING COLORS\n' +
    ' * ─────────────────────────────────────────────────────────────────────────────\n' +
    ' *\n' +
    ' * This file contains TWO layers of colour variables:\n' +
    ' *\n' +
    ' *  1. PRIMITIVE COLORS  (--primitive-*)\n' +
    ' *     Raw palette swatches (e.g. --primitive-primary-color-pallete-primary90).\n' +
    ' *     ❌  Do NOT reference these in component or page CSS.\n' +
    ' *     ✅  They exist as a reference foundation and to power the colour roles\n' +
    ' *         below.  At build time all references have been resolved to hex so\n' +
    ' *         the file has no runtime dependencies.\n' +
    ' *\n' +
    ' *  2. COLOR ROLES  (--color-*)\n' +
    ' *     Semantic colour slots (e.g. --color-primary, --color-on-surface).\n' +
    ' *     ✅  These are the only colour variables you should use in UI code.\n' +
    ' *     Each role maps to the appropriate primitive for the current theme.\n' +
    ' *\n' +
    ' * ─────────────────────────────────────────────────────────────────────────────\n' +
    ' */\n' +
    '\n' +
    ':root {'
  );

  // ------------------------------------------------------------------
  // 4.3  EFFECTS (shadows)
  // ------------------------------------------------------------------
  console.log('\nProcessing effects...');
  var effectLines = [];

  if (tokens.effect) {
    Object.entries(tokens.effect).forEach(function(entry) {
      effectLines.push(convertEffect(entry[0], entry[1]));
    });
  }
  outputLines.push(
    section(
      'EFFECTS — Drop Shadows',
      effectLines.join('\n'),
      'Use these variables wherever box-shadow is needed rather than hard-coding shadow values.'
    )
  );
  console.log('   ' + effectLines.length + ' effect(s) converted.');

  // ------------------------------------------------------------------
  // 4.4  PRIMITIVE COLORS
  // ------------------------------------------------------------------
  console.log('\nProcessing primitive colors...');
  var primitiveLines = [];

  if (tokens['primitive colors']) {
    var pc = tokens['primitive colors'];

    // Key colours group
    if (pc['key colors group']) {
      primitiveLines.push('\n  /* -- Key Colours (source seeds for each palette) -- */');
      Object.entries(pc['key colors group']).forEach(function(entry) {
        var name  = entry[0];
        var token = entry[1];
        var colour = normaliseColor(token.value);
        primitiveLines.push('  --primitive-key-' + toKebabCase(name) + ': ' + colour + ';');
      });
    }

    // Colour palettes (primary, secondary, tertiary, neutral, neutralvariant, error)
    var palettes = [
      'primary color pallete',
      'secondary color pallete',
      'tertiary color pallete',
      'neutral color pallete',
      'neutralvariant color pallete',
      'error color pallete',
    ];

    palettes.forEach(function(paletteName) {
      if (!pc[paletteName]) return;

      var prettyName = paletteName
        .replace(' color pallete', '')
        .replace('neutralvariant', 'neutral-variant');

      primitiveLines.push(
        '\n  /* -- ' + prettyName.charAt(0).toUpperCase() + prettyName.slice(1) + ' Palette -- */'
      );
      var declarations = convertPrimitivePalette(paletteName, pc[paletteName]);
      declarations.forEach(function(d) { primitiveLines.push(d); });
    });
  }

  outputLines.push(
    section(
      'PRIMITIVE COLORS — Foundation Layer (DO NOT USE IN UI)',
      primitiveLines.join('\n'),
      'These are raw palette swatches shared across all themes.\n' +
      '   *        They are prefixed with --primitive-* to signal that they should NOT\n' +
      '   *        be applied directly in component or page stylesheets.\n' +
      '   *        Reference --color-* semantic roles instead (see section below).'
    )
  );
  var primitiveCount = primitiveLines.filter(function(l) { return l.includes(':'); }).length;
  console.log('   ' + primitiveCount + ' primitive colour(s) converted.');

  // ------------------------------------------------------------------
  // 4.5  COLOR ROLES (semantic layer)
  // ------------------------------------------------------------------
  console.log('\nProcessing color roles...');
  var roleLines = [];

  if (tokens['color roles']) {
    // Group roles into logical clusters for documentation clarity in the CSS.
    var groups = {
      'Primary':   ['primary', 'on primary', 'primary container', 'on primary container'],
      'Secondary': ['secondary', 'on secondary', 'secondary container', 'on secondary container'],
      'Tertiary':  ['tertiary', 'on tertiary', 'tertiary container', 'on tertiary container'],
      'Error':     ['error', 'on error', 'error container', 'on error container'],
      'Surface': [
        'surface',
        'on surface',
        'surface variant',
        'on surface variant',
        'surface container highest',
        'surface container high',
        'surface container lowest',
        'surface tint',
        'inverse surface',
        'inverse on surface',
      ],
      'Outline': ['outline', 'outline variant'],
      'Fixed Variants': [
        'primary fixed ad on',
        'on primary fixed ad on',
        'primary fixed dim ad on',
        'on primary fixed variant',
      ],
    };

    // Track which roles have been explicitly grouped so we can catch any
    // ungrouped tokens that may be added to the JSON in the future.
    var groupedRoles = new Set();
    Object.values(groups).forEach(function(arr) { arr.forEach(function(r) { groupedRoles.add(r); }); });

    Object.entries(groups).forEach(function(groupEntry) {
      var groupName = groupEntry[0];
      var roleNames = groupEntry[1];
      roleLines.push('\n  /* -- ' + groupName + ' -- */');

      roleNames.forEach(function(roleName) {
        var token = tokens['color roles'][roleName];
        if (!token) {
          roleLines.push('  /* [missing] ' + roleName + ' */');
          return;
        }
        roleLines.push(convertColorRole(roleName, token, tokens));
      });
    });

    // Emit any remaining ungrouped colour roles so nothing is silently dropped.
    var ungrouped = Object.keys(tokens['color roles']).filter(function(k) { return !groupedRoles.has(k); });
    if (ungrouped.length > 0) {
      roleLines.push('\n  /* -- Ungrouped (check design token file) -- */');
      ungrouped.forEach(function(roleName) {
        roleLines.push(convertColorRole(roleName, tokens['color roles'][roleName], tokens));
      });
    }
  }

  outputLines.push(
    section(
      'COLOR ROLES — Semantic Layer (USE THESE IN UI)',
      roleLines.join('\n'),
      'Every variable here maps to a primitive palette swatch.\n' +
      '   *        References have been resolved at generation time so these variables\n' +
      '   *        carry their concrete hex values.  When adding colours to components\n' +
      '   *        ALWAYS prefer --color-* over --primitive-* or hard-coded hex.'
    )
  );
  var roleCount = roleLines.filter(function(l) { return l.includes('--color-'); }).length;
  console.log('   ' + roleCount + ' colour role(s) converted.');

  // ------------------------------------------------------------------
  // 4.6  SPACING SCALE
  // ------------------------------------------------------------------
  console.log('\nProcessing spacing...');
  var spacingLines = [];

  if (tokens['spacing collections']) {
    spacingLines.push('');
    Object.entries(tokens['spacing collections']).forEach(function(entry) {
      spacingLines.push(convertSpacing(entry[0], entry[1]));
    });
  }

  outputLines.push(
    section(
      'SPACING — Scale Tokens',
      spacingLines.join('\n'),
      'Use these spacing values for margin, padding, gap, etc. Avoid magic numbers.'
    )
  );
  var spacingCount = spacingLines.filter(function(l) { return l.includes('--spacing-'); }).length;
  console.log('   ' + spacingCount + ' spacing token(s) converted.');

  // ------------------------------------------------------------------
  // 4.7  TYPOGRAPHY SCALE
  // ------------------------------------------------------------------
  console.log('\nProcessing typography...');
  var typographyLines = [];

  if (tokens.typography) {
    Object.entries(tokens.typography).forEach(function(entry) {
      var scaleName  = entry[0];
      var scaleToken = entry[1];
      typographyLines.push('\n  /* -- ' + scaleName + ' -- */');
      var declarations = convertTypography(scaleName, scaleToken);
      declarations.forEach(function(d) { typographyLines.push(d); });
    });
  }

  outputLines.push(
    section(
      'TYPOGRAPHY — Type Scale Tokens',
      typographyLines.join('\n'),
      'Each type scale (e.g. "display large") is broken into individual\n' +
      '   *        CSS properties so you can mix and match as needed, or use them\n' +
      '   *        together with a utility class. Font families are "Inter" (display)\n' +
      '   *        and "DM Sans" (all other scales). Add both to your @font-face / CDN.'
    )
  );
  var typoCount = typographyLines.filter(function(l) { return l.includes('--type-'); }).length;
  console.log('   ' + typoCount + ' typography declaration(s) converted.');

  // ------------------------------------------------------------------
  // 4.8  Close :root and write file
  // ------------------------------------------------------------------
  outputLines.push('\n} /* end :root */\n');

  var css = outputLines.join('\n');

  console.log('\nWriting: ' + OUTPUT_FILE);
  try {
    fs.writeFileSync(OUTPUT_FILE, css, 'utf8');
  } catch (err) {
    console.error('\nFailed to write output file:\n   ' + err.message);
    process.exit(1);
  }

  console.log('\nDone!');
  console.log('   Output -> ' + OUTPUT_FILE);
  console.log('   File size: ' + (Buffer.byteLength(css, 'utf8') / 1024).toFixed(1) + ' KB\n');
}

// ---------------------------------------------------------------------------
// 5. RUN
// ---------------------------------------------------------------------------
generateCSS();
