**Invoice Memory Engine**


**Overview**

This project implements a memory layer on top of an invoice extraction pipeline using a four-stage workflow: recall → apply → decide → learn. It consumes extracted invoice, PO, delivery note, and human correction data, then produces a normalized invoice and decision metadata to improve automation over time.
