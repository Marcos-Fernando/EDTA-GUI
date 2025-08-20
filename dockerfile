FROM ubuntu:22.04

RUN apt-get update -y \
    && apt-get upgrade -y \
    && apt-get install -y curl gnupg wget git vim

COPY . /usr/local/EDTA
COPY AnnoTEP/Scripts/break_fasta.pl /usr/local/bin/

RUN wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh \
    && bash Miniconda3-latest-Linux-x86_64.sh -b -p /usr/local/miniconda3 \
    && rm -f Miniconda3-latest-Linux-x86_64.sh

ENV CONDA_PREFIX=/usr/local/miniconda3
ENV PATH="/usr/local/miniconda3/bin:$PATH"

RUN conda config --set channel_priority flexible \
 && conda config --add channels defaults \
 && conda config --add channels conda-forge \
 && conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main \
 && conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r


RUN cd /usr/local/EDTA \
    && /bin/bash install.sh

ENV LC_ALL=C.UTF-8
ENV LANG=C.UTF-8


EXPOSE 5000

COPY gui_docker/ /usr/local/EDTA/gui

WORKDIR /usr/local/EDTA/gui

# RUN rm -rf gui_docker/

VOLUME /usr/local/EDTA/gui/results

CMD ["bash", "-c", "source /usr/local/miniconda3/etc/profile.d/conda.sh && conda activate EDTAgui && flask run --host=0.0.0.0 --port=5000"]
