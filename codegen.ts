#!/usr/bin/env node

import { Generator } from "./generator/Generator.js";

const generator = new Generator(); 

await generator.generate(); 