1. **Update model interface and bit contract.**
   - Overwrite `packages/700.microserviceaudio/96.model.unit/fce/model.interface.ts` with `VocoderEngineType`, `VocoderEngineDescriptor`, `LatentTensorDescriptor` and the correct `Model` interface as specified in the directive.
   - Overwrite `packages/700.microserviceaudio/96.model.unit/fce/model.bit.ts` with `ModelResolutionPayload`, `MmapArgsResult`, `MemoryBudgetReport`, `LatentResolutionResult` and the `ModelBit` interface as specified in the directive.
2. **Update model action classes and model initialization.**
   - Modify `packages/700.microserviceaudio/96.model.unit/model.action.ts` to include `RESOLVE_LATENT_TENSOR`, `AUDIT_MEMORY_BUDGET`, and `CONFIGURE_MMAP_ARGS` and its classes as per the directive. Make sure to export them in the `Actions` type.
   - Overwrite `packages/700.microserviceaudio/96.model.unit/model.model.ts` to export the class `ModelModel` containing all the vocoder engine descriptor defaults and initializing variables according to the directive.
3. **Implement Memory Management and Tensor Resolution logic in `buz/model.buzz.ts` and `model.buzzer.ts`.**
   - Overwrite `packages/700.microserviceaudio/96.model.unit/buz/model.buzz.ts` with `assertHostMemoryBudget`, `resolveLatentTensorPath`, `buildMmapModelArgs`, `resolveLatentTensor`, `auditMemoryBudget`, `configureMmapArgs`, `initModel` and `updateModel` exactly as described in the directive file.
   - Overwrite `packages/700.microserviceaudio/96.model.unit/model.buzzer.ts` to export these logic functions instead of the default ones.
4. **Update the reducer to handle new actions.**
   - In `packages/700.microserviceaudio/96.model.unit/model.reduce.ts`, change the switch cases to match `Act.INIT_MODEL`, `Act.UPDATE_MODEL`, `Act.RESOLVE_LATENT_TENSOR`, `Act.AUDIT_MEMORY_BUDGET` and `Act.CONFIGURE_MMAP_ARGS` and route to the corresponding buz functions according to the directive.
5. **Add `[MODEL: VERIFY MMAP LATENT TENSORS]` choice to menu buzz.**
   - Modfy `packages/700.microserviceaudio/98.menu.unit/buz/00.menu.buzz.ts` and add `'[MODEL: VERIFY MMAP LATENT TENSORS]'` to the `lst` in `updateMenu` right at the start of the list.
   - Add a switch case for `'[MODEL: VERIFY MMAP LATENT TENSORS]'` inside `updateMenu` to trigger `ActMdl.AUDIT_MEMORY_BUDGET` and update `cns00` with the `memoryReport` status, as shown in the directive.
6. **Create tests for Phase 3.**
   - Create `packages/700.microserviceaudio/val/model.test.ts` with the unit test code block in the directive for testing Phase 3.
   - Ensure the new file was created and verify its content.
7. **Run tests**
   - cd into `packages/700.microserviceaudio` and run `npx vitest run val/model.test.ts` to verify tests pass. Also run `npx vitest run val/` to run all audio tests. Ensure I am back at the root repo after executing tests.
8. **Complete pre-commit steps.**
   - Complete pre commit steps to ensure proper testing, verification, review, and reflection are done. This includes running the newly created Vitest file.
9. **Submit the changes.**
   - Complete work using submit tool.
