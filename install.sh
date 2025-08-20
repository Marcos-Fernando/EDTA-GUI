#!/bin/bash

# To ensure conda is loaded correctly
# (required on some systems)
source "$(conda info --base)/etc/profile.d/conda.sh"

conda env create -f edta_env.yml

conda env create -f annotep_env.yml

echo "✅ Environments created!"
echo "Use 'conda activate EDTAgui' to activate."