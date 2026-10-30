# EDTA-GUI / AnnoTEP: web interface (React) + API (FastAPI) + pipelines, in one image.
#
# Users:        gui/start.sh (downloads the published image, or builds it locally).
# Maintainers:  gui/publish.sh v2.0 (builds and pushes annotep/edta-gui:v2.0).
# Manual build, from the REPOSITORY ROOT (the pipelines live there):
#   docker build -f gui/Dockerfile -t annotep/edta-gui:dev .
# See README.md (Docker sections).
#
# The files excluded from the build are in gui/Dockerfile.dockerignore (it replaces the root
# .dockerignore, which belongs to the legacy image).

# ---------------------------------------------------------------- 1. web interface (build only)
FROM node:22-bookworm-slim AS frontend
WORKDIR /src
COPY gui/frontend/package.json gui/frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY gui/frontend/ ./
# Real backend (not the mock), same origin: the API is at /api.
ENV VITE_USE_MOCK=false VITE_API_BASE=
RUN npm run build

# ---------------------------------------------------------------- 2. pipelines + API
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive \
    LC_ALL=C.UTF-8 \
    LANG=C.UTF-8
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends ca-certificates curl wget procps \
    && rm -rf /var/lib/apt/lists/*

# Miniconda (same channels setup as the legacy image)
ENV CONDA_DIR=/usr/local/miniconda3
ENV PATH="${CONDA_DIR}/bin:${PATH}"
RUN wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh \
    && bash /tmp/miniconda.sh -b -p "${CONDA_DIR}" \
    && rm -f /tmp/miniconda.sh \
    && conda config --set channel_priority flexible \
    && conda config --add channels defaults \
    && conda config --add channels conda-forge \
    && conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main \
    && conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r

# Only the two environments used by the new GUI, one layer each (smaller layers are safer to
# push and pull from Docker Hub). They come first so that code changes do not rebuild them
# (this is the slow step).
#   EDTAgui          -> EDTA and panEDTA
#   annotepgui_3_11  -> AnnoTEP + the FastAPI backend
COPY edta_env.yml /tmp/envs/
RUN conda env create -f /tmp/envs/edta_env.yml && conda clean -afy && rm -rf /tmp/envs
COPY annotep_env_3_11.yml /tmp/envs/
RUN conda env create -f /tmp/envs/annotep_env_3_11.yml && conda clean -afy && rm -rf /tmp/envs

# RepeatMasker: accept sequence names up to 80 characters (maxIDLength 50 -> 80), which avoids
# "sequence identifier which is too long". Changes only the copies inside this image.
RUN for env in EDTAgui annotepgui_3_11; do \
        for f in "${CONDA_DIR}/envs/${env}/share/RepeatMasker/RepeatMasker" \
                 "${CONDA_DIR}/envs/${env}/share/RepeatMasker/ProcessRepeats"; do \
            if [ -f "$f" ]; then \
                sed -i -E 's/maxIDLength([[:space:]]*)=>([[:space:]]*)50/maxIDLength\1=>\280/' "$f"; \
            fi; \
        done; \
    done

# Pipelines (EDTA.pl, panEDTA.sh, bin/, util/, AnnoTEP/ ...) and the new GUI.
COPY . /usr/local/EDTA
COPY AnnoTEP/Scripts/break_fasta.pl /usr/local/bin/
COPY --from=frontend /src/dist /usr/local/EDTA/gui/frontend/dist

# Results are written to a folder of the user's machine (volume). The container runs with the
# user's own UID/GID (gui/start.sh), so HOME must be writable by anyone.
RUN mkdir -p /usr/local/EDTA/gui/backend/results /home/edta \
    && chmod 1777 /home/edta \
    && chmod 755 /usr/local/bin/break_fasta.pl

# cli/: the EDTA, AnnoTEP and panEDTA commands (docker run <image> AnnoTEP --genome ...).
ENV PATH="/usr/local/EDTA/cli:${PATH}" \
    HOME=/home/edta \
    CONDA_EXE=${CONDA_DIR}/bin/conda \
    EDTA_DIR=/usr/local/EDTA \
    RESULTS_DIR=/usr/local/EDTA/gui/backend/results \
    LEGACY_RESULTS_DIRS= \
    FRONTEND_DIST=/usr/local/EDTA/gui/frontend/dist \
    EDTA_CONDA_ENV=EDTAgui \
    ANNOTEP_CONDA_ENV=annotepgui_3_11

WORKDIR /usr/local/EDTA/gui/backend
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8000/api/health || exit 1

CMD ["/usr/local/miniconda3/bin/conda", "run", "--no-capture-output", "-n", "annotepgui_3_11", \
     "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Last on purpose: a new version number must not invalidate the cached conda layers.
ARG VERSION=dev
LABEL org.opencontainers.image.title="AnnoTEP GUI (EDTA-GUI / panEDTA-GUI / AnnoTEP)" \
      org.opencontainers.image.version="${VERSION}"
