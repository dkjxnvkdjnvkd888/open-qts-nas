FROM debian:bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    live-build debootstrap squashfs-tools xorriso isolinux syslinux-common \
    grub-pc-bin grub-efi-amd64-bin mtools dosfstools curl rsync ca-certificates \
    gnupg sudo \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
CMD ["bash", "iso-builder/build-iso.sh"]
