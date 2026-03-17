#!/bin/bash
sudo docker run --rm -v moneyleh-app_moneyleh-app-data:/data -v $(pwd):/backup alpine   tar czf /backup/mydata-volume.tar.gz -C /data .