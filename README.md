# frourio-framework-prisma-generators

## Requirements
- prisma, @prisma/client@5.20.0
  - both needs to be same version

## Install

```bash
npm install -D frourio-framework-prisma-generators
```

```prisma
// model generator
generator frourio_framework_prisma_model_generator {
    provider = "frourio-framework-prisma-model-generator"
    output   = "__generated__/models"
}
```
