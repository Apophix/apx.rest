#!/usr/bin/env tsx
import { Generator } from "./generator/Generator.js";
const generator = new Generator();
await generator.generate();
