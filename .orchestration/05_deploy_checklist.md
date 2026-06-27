# 05 Deploy Checklist

Automatic public demo deployment is allowed only if:
- no secrets
- no backend
- no student data
- no account system
- no payment
- tests pass
- build passes
- smoke checks pass
- marker `AI Ethics Quest 3D` exists in deployed HTML or JS bundle

Commands:
```bash
npm test
npm run build
node tests/dom-smoke.mjs
```

GitHub Pages target: static build output or root depending final app structure.
